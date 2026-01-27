import { initializeDatabase } from "@/lib/database";
import { retryRequest } from "@/lib/retryRequest";
// import { storageContractsInFile } from "@/utils/storage-contracts";
import { logger } from "@/shared";
import {
	type APIResponse,
	type Contract,
	ContractingModalityCode,
	type Item,
	type OutputItens,
} from "@/types";
import { GetContracts } from "@/use-cases/get-contracts";
import { saveItemsToDatabase, saveItemsToJSON } from "@/utils/storage-itens";
import "./_config/module-alias";
import type { IItensRepository } from "@/repositories/ItensRepository";

import { PostgresItensRepository } from "@/repositories/ItensRepository";
import { delay, formatarData, parseBrDateToISO } from "@/utils";

interface MainConfig {
	codigoModalidadeContratacao: number;
	startDateOfProposalReceiptPeriod: string;
	endDateOfProposalReceiptPeriod: string;
	folderToStorage: string;
	timeDelay: number;
	uf?: string;
}

async function fetchAndProcessItem(
	contract: Contract,
	index: number,
	config: MainConfig,
	baseUrl: string | undefined,
	itemRepository: IItensRepository,
) {
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
		return;
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
	await saveItemsToDatabase([item], itemRepository);
	await saveItemsToJSON({
		codigoModalidadeContratacao: config.codigoModalidadeContratacao,
		itens: [item],
		startDateOfProposalReceiptPeriod: config.startDateOfProposalReceiptPeriod,
		endDateOfProposalReceiptPeriod: config.endDateOfProposalReceiptPeriod,
		folderToStorage: config.folderToStorage,
	});

	await delay(config.timeDelay);
}

async function processContract(
	contract: Contract,
	config: MainConfig,
	itemRepository: IItensRepository,
) {
	const baseUrl = process.env.PNCP_INTEGRATION_URL;
	logger.notice(
		`Processando contrato ${contract.unidadeOrgao.nomeUnidade} - ${contract.numeroCompra}/${contract.anoCompra}`,
	);

	const dataEncerramentoMenorQueDataInicio =
		new Date(contract.dataEncerramentoProposta) <
		new Date(parseBrDateToISO(config.startDateOfProposalReceiptPeriod));

	if (dataEncerramentoMenorQueDataInicio) {
		logger.warn(
			`Contrato com data de encerramento ${contract.dataEncerramentoProposta} menor que a data de início ${config.startDateOfProposalReceiptPeriod}, pulando para o próximo contrato.`,
		);
		return;
	}

	if (contract.srp === true) {
		logger.warn("Contrato é de registro de preço, pulando armazenamento.");
		return;
	}

	for (let index = 1; index < 1000; index++) {
		try {
			await fetchAndProcessItem(
				contract,
				index,
				config,
				baseUrl,
				itemRepository,
			);
			// biome-ignore lint/suspicious/noExplicitAny: <é any mesmo>
		} catch (error: any) {
			if (error.response && error.response.status === 404) {
				// Optimization: Stop if an item is not found, assuming sequential items.
				// This prevents hundreds of unnecessary 404 requests that could trigger rate limiting.
				// Remove the break if items are not sequential.
				break;
			}
			// Propagate other errors to be handled by the caller (page loop)
			throw error;
		}
	}
}

async function main({
	codigoModalidadeContratacao,
	startDateOfProposalReceiptPeriod,
	endDateOfProposalReceiptPeriod,
	folderToStorage,
	timeDelay,
	paginaInicial,
	uf = "SP",
}: MainConfig & { paginaInicial: number }) {
	await initializeDatabase();
	logger.info("Banco de dados inicializado.");

	const itemRepository = new PostgresItensRepository();

	const getContracts = new GetContracts();
	// Initial request to get total pages
	const response = await getContracts.execute({
		codigoModalidadeContratacao,
		page: 1,
		startDateOfProposalReceiptPeriod,
		endDateOfProposalReceiptPeriod,
		uf,
	});

	const { totalRegistros, totalPaginas } = response;
	logger.info({ totalRegistros, totalPaginas });

	const config: MainConfig = {
		codigoModalidadeContratacao,
		startDateOfProposalReceiptPeriod,
		endDateOfProposalReceiptPeriod,
		folderToStorage,
		timeDelay,
		uf,
	};

	for (let i = paginaInicial; i <= totalPaginas; i++) {
		logger.info(`Processando página ${i} de ${totalPaginas}`);

		let pageResponse: APIResponse;
		try {
			pageResponse = await getContracts.execute({
				codigoModalidadeContratacao,
				page: i,
				startDateOfProposalReceiptPeriod,
				endDateOfProposalReceiptPeriod,
				uf,
			});
			// biome-ignore lint/suspicious/noExplicitAny: <é any mesmo>
		} catch (error: any) {
			const apiErrorMsg = error.response?.data?.message || error.message;
			throw new Error(
				`Erro na página ${i}. Reinicie a partir desta página. Mensagem original: ${apiErrorMsg}`,
			);
		}

		const { data: contractsData } = pageResponse;
		if (!Array.isArray(contractsData)) {
			console.warn(
				`Página ${i}: contractsData não é um array, pulando página. Response:`,
				JSON.stringify(pageResponse, null, 2),
			);
			logger.warn(`Página ${i}: contractsData não é um array, pulando página.`);
			continue;
		}

		for (const contract of contractsData) {
			try {
				await processContract(contract, config, itemRepository);
				// biome-ignore lint/suspicious/noExplicitAny: <é any mesmo>
			} catch (error: any) {
				const apiErrorMsg = error.response?.data?.message || error.message;
				logger.error(`Erro processando contrato na página ${i}:`, apiErrorMsg);
				throw new Error(
					`Erro fatal na página ${i} ao processar contrato. ${apiErrorMsg}`,
				);
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
			message: error.response?.data?.message || error.message,
			code: error.code,
			status: error.status,
			stack: error.stack,
		});
	});
