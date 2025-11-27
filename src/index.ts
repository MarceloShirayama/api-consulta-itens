import "./_config/module-alias";
import { retryRequest } from "@/lib/retryRequest";
// import { storageContractsInFile } from "@/utils/storage-contracts";
import { logger } from "@/shared";
import { ContractingModalityCode, type Item } from "@/types";
import { GetContracts } from "@/use-cases/get-contracts";
import { storageItens } from "@/utils/storage-itens";

export type OutputContracts = {
	orgaoEntidade: string;
	cnpj: string;
	nomeUnidade: string;
	municipioNome: string;
	anoCompra: number;
	sequencialCompra: number;
	modalidadeNome: string;
	modoDisputaNome: string;
	registroDePreco: string;
	dataAberturaProposta: string;
	dataEncerramentoProposta: string;
};

export type OutputItens = {
	orgao: string;
	unidade: string;
	municipio: string;
	compra: string;
	dataEncerramentoProposta: string;
	modalidade: string;
	disputa: string;
	registroPreco: string;
	item: number;
	descricao: string;
	quantidade: number;
	unidadeDeMedida: string;
	valorUnitarioEstimado: number | string;
	valorTotal: number | string;
	link: string;
};

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatarData(dataIso: string): string {
	const [ano, mes, dia] = dataIso.split("T")[0].split("-");
	return `${ano}-${mes}-${dia}`;
}

function parseBrDateToISO(dateBr: string): string {
	const [dia, mes, ano] = dateBr.split("-");
	return `${ano}-${mes}-${dia}T00:00:00`;
}

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
	const getContracts = new GetContracts();
	const response = await getContracts.execute({
		codigoModalidadeContratacao,
		page: 1,
		startDateOfProposalReceiptPeriod,
		endDateOfProposalReceiptPeriod,
	});
	const { totalRegistros, totalPaginas } = response;
	logger.warn({ totalRegistros, totalPaginas });
	for (let i = paginaInicial; i <= totalPaginas; i++) {
		logger.warn(`Processando página ${i} de ${totalPaginas}`);
		// biome-ignore lint/suspicious/noImplicitAnyLet: quero any mesmo
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
		const baseUrl = process.env.PNCP_INTEGRATION_URL;
		for (const contract of contractsData) {
			// if (contract.modalidadeId !== 6 && contract.modalidadeId !== 8) {
			// 	continue; // pula para o próximo contrato
			// }
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
				continue; // se for registro de preço pula para o próximo contrato
			}
			try {
				for (let index = 1; index < 1000; index++) {
					const url = `${baseUrl}/v1/orgaos/${contract.orgaoEntidade.cnpj}/compras/${contract.anoCompra}/${contract.sequencialCompra}/itens/${index}`;
					const response = await retryRequest<Item>(url);
					logger.warn(
						`${contract.orgaoEntidade.razaoSocial} - ${contract.unidadeOrgao.nomeUnidade} -${contract.dataEncerramentoProposta} - item ${index} - data ${contract.dataEncerramentoProposta}`,
					);
					const item: OutputItens = {
						orgao: contract.orgaoEntidade.razaoSocial,
						unidade: `${contract.unidadeOrgao.codigoUnidade} - ${contract.unidadeOrgao.nomeUnidade}`,
						municipio: contract.unidadeOrgao.municipioNome,
						compra: `${contract.numeroCompra}/${contract.anoCompra}`,
						dataEncerramentoProposta: formatarData(
							contract.dataEncerramentoProposta,
						),
						modalidade: contract.modalidadeNome,
						disputa: contract.modoDisputaNome,
						registroPreco: contract.srp ? "SIM" : "NÃO",
						item: index,
						descricao: response.data.descricao.toLowerCase(),
						quantidade: response.data.quantidade,
						unidadeDeMedida: response.data.unidadeDeMedida,
						valorUnitarioEstimado:
							response.data.valorUnitarioEstimado !== undefined &&
							response.data.valorUnitarioEstimado !== null
								? Number(response.data.valorUnitarioEstimado)
										.toFixed(2)
										.replace(".", ",")
								: "0",
						valorTotal:
							response.data.valorTotal !== undefined &&
							response.data.valorTotal !== null
								? Number(response.data.valorTotal).toFixed(2).replace(".", ",")
								: "0",
						link: `https://pncp.gov.br/app/editais/${contract.orgaoEntidade.cnpj}/${contract.anoCompra}/${contract.sequencialCompra}`,
					};
					// Armazena imediatamente o item encontrado
					storageItens({
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
					logger.warn(
						"Não foram encontrados mais itens neste contrato, pulando para o próximo contrato",
					);
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
	startDateOfProposalReceiptPeriod: "26-11-2025",
	endDateOfProposalReceiptPeriod: "28-11-2025",
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
