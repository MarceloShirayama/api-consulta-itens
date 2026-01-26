import { initializeDatabase } from "@/lib/database";
import { retryRequest } from "@/lib/retryRequest";
// import { storageContractsInFile } from "@/utils/storage-contracts";
import { logger } from "@/shared";
import { ContractingModalityCode, type Item, type OutputItens } from "@/types";
import { GetContracts } from "@/use-cases/get-contracts";
import { storageItens } from "@/utils/storage-itens";
import "./_config/module-alias";
import { delay, formatarData, parseBrDateToISO } from "@/utils";

async function main({
	codigoModalidadeContratacao,
	startDateOfProposalReceiptPeriod,
	endDateOfProposalReceiptPeriod,
	folderToStorage,
	timeDelay,
	paginaInicial,
}: {
	codigoModalidadeContratacao: number;
	startDateOfProposalReceiptPeriod: string;
	endDateOfProposalReceiptPeriod: string;
	folderToStorage: string;
	timeDelay: number;
	paginaInicial: number;
}) {
	await initializeDatabase();
	logger.info("Banco de dados inicializado.");

	const getContracts = new GetContracts();
	const response = await getContracts.execute({
		codigoModalidadeContratacao,
		page: 1,
		startDateOfProposalReceiptPeriod,
		endDateOfProposalReceiptPeriod,
	});
	const { totalRegistros, totalPaginas } = response;
	logger.info({ totalRegistros, totalPaginas });
	for (let i = paginaInicial; i <= totalPaginas; i++) {
		logger.info(`Processando página ${i} de ${totalPaginas}`);
		// biome-ignore lint/suspicious/noImplicitAnyLet: <queo any mesmo>
		let response;
		try {
			response = await getContracts.execute({
				codigoModalidadeContratacao,
				page: i,
				startDateOfProposalReceiptPeriod,
				endDateOfProposalReceiptPeriod,
			});
			// biome-ignore lint/suspicious/noExplicitAny: quero any mesmo
		} catch (error: any) {
			throw new Error(
				`Erro na página ${i}. Reinicie a partir desta página. Mensagem original: ${error.message}`,
			);
		}
		const { data: contractsData } = response;
		if (!Array.isArray(contractsData)) {
			console.warn(
				`Página ${i}: contractsData não é um array, pulando página. Response:`,
				JSON.stringify(response, null, 2),
			);
			logger.warn(`Página ${i}: contractsData não é um array, pulando página.`);
			continue; // pula para a próxima página
		}
		const baseUrl = process.env.PNCP_INTEGRATION_URL;
		for (const contract of contractsData) {
			logger.notice(
				`Processando contrato ${contract.unidadeOrgao.nomeUnidade} - ${contract.numeroCompra}/${contract.anoCompra}`,
			);
			const dataEncerramentoMenorQueDataInicio =
				new Date(contract.dataEncerramentoProposta) <
				new Date(parseBrDateToISO(startDateOfProposalReceiptPeriod));

			if (dataEncerramentoMenorQueDataInicio) {
				logger.warn(
					`Contrato com data de encerramento ${contract.dataEncerramentoProposta} menor que a data de início ${startDateOfProposalReceiptPeriod}, pulando para o próximo contrato.`,
				);
				continue; // pula para o próximo contrato
			}
			if (contract.srp === true) {
				logger.warn("Contrato é de registro de preço, pulando armazenamento.");
				continue; // se for registro de preço pula para o próximo contrato
			}
			try {
				for (let index = 1; index < 1000; index++) {
					const url = `${baseUrl}/v1/orgaos/${contract.orgaoEntidade.cnpj}/compras/${contract.anoCompra}/${contract.sequencialCompra}/itens/${index}`;
					const response = await retryRequest<Item>(url);
					const servicoVariacoes = [
						"SERV",
						"SRV",
						"SERVIÇO",
						"SV",
						"SERV.",
						"SERVICO",
						"SRVC",
						"SER",
					];
					const unidadeMedidaNormalizada = response.data.unidadeMedida
						?.trim()
						.replace(/[\n\r\t\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, "")
						.toUpperCase();

					if (
						response.data.materialOuServico === "S" ||
						servicoVariacoes.includes(unidadeMedidaNormalizada)
					) {
						logger.warn(
							`Pulando materialOuServico ${response.data.materialOuServico} | unidadeMedida ${response.data.unidadeMedida} | ${response.data.descricao}`,
						);
						continue;
					}
					const item: OutputItens = {
						orgao: contract.orgaoEntidade.razaoSocial.trim(),
						unidade:
							`${contract.unidadeOrgao.codigoUnidade} - ${contract.unidadeOrgao.nomeUnidade}`.trim(),
						municipio: contract.unidadeOrgao.municipioNome.trim(),
						compra: `${contract.numeroCompra}/${contract.anoCompra}`,
						dataEncerramentoProposta: formatarData(
							contract.dataEncerramentoProposta,
						).trim(),
						modalidade: contract.modalidadeNome.trim(),
						disputa: contract.modoDisputaNome.trim(),
						registroPreco: contract.srp ? "SIM" : "NÃO",
						item: index,
						descricao: response.data.descricao.toLowerCase().trim(),
						quantidade: response.data.quantidade,
						unidadeMedida: response.data.unidadeMedida.trim() ?? "",
						valorUnitarioEstimado: response.data.valorUnitarioEstimado,
						valorTotal: response.data.valorTotal,
						link: `https://pncp.gov.br/app/editais/${contract.orgaoEntidade.cnpj}/${contract.anoCompra}/${contract.sequencialCompra}`,
					};
					// Armazena imediatamente o item encontrado
					await storageItens({
						codigoModalidadeContratacao,
						itens: [item],
						startDateOfProposalReceiptPeriod,
						endDateOfProposalReceiptPeriod,
						folderToStorage,
					});
					await delay(timeDelay);
				}
				// biome-ignore lint/suspicious/noExplicitAny: false positive
			} catch (error: any) {
				if (error.response && error.response.status === 404) {
					// logger.warn(
					// 	"Não foram encontrados mais itens neste contrato, pulando para o próximo contrato",
					// );
				} else {
					logger.error(`Erro na página ${i}:`, error.message);
					// Retorna a página em que parou
					throw new Error(
						`Erro na página ${i}. Reinicie a partir desta página.`,
					);
				}
			}
		}
	}
}

const inicio = Date.now();

main({
	codigoModalidadeContratacao: ContractingModalityCode["Dispensa de Licitação"],
	startDateOfProposalReceiptPeriod: "26-01-2026",
	endDateOfProposalReceiptPeriod: "06-02-2026",
	folderToStorage: "_itens",
	timeDelay: 250,
	paginaInicial: 1,
})
	.then(() => {
		logger.warn("Processo finalizado");
		const fim = Date.now();
		const duracao = fim - inicio;
		const duracaoEmMinutos = (duracao / 1000 / 60).toFixed(2);
		logger.warn(`Duração do processo: ${duracaoEmMinutos} minutos`);
	})
	.catch((error) => {
		logger.error("Ocorreu um erro ao executar o processo", {
			message: error.message,
			stack: error.stack,
		});
	});
