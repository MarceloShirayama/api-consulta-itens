import inquirer from "inquirer";
import { initializeDatabase } from "@/lib/database";
import { retryRequest } from "@/lib/retryRequest";
// import { storageContractsInFile } from "@/utils/storage-contracts";
import { logger } from "@/shared";
import {
	type APIResponse,
	type Contract,
	ContractingModalityCode,
	type Item,
	type MainConfig,
	type OutputItens,
	type ProcessingStats,
	type PromptAnswers,
} from "@/types";
import { GetContracts } from "@/use-cases/get-contracts";
import { saveItemsToDatabase, saveItemsToJSON } from "@/utils/storage-itens";
import "./_config/module-alias";
import type { IItensRepository } from "@/repositories/ItensRepository";

import { PostgresItensRepository } from "@/repositories/ItensRepository";
import { delay, formatarData, parseBrDateToISO } from "@/utils";

function convertItemDataToOutputItem(
	contract: Contract,
	index: number,
	itemData: Item,
): OutputItens {
	return {
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
		descricao: itemData.descricao.toLowerCase().trim(),
		quantidade: itemData.quantidade,
		unidadeMedida: itemData.unidadeMedida.trim() ?? "",
		valorUnitarioEstimado: itemData.valorUnitarioEstimado,
		valorTotal: itemData.valorTotal,
		link: `https://pncp.gov.br/app/editais/${contract.orgaoEntidade.cnpj}/${contract.anoCompra}/${contract.sequencialCompra}`,
	};
}

async function fetchAndProcessItem(
	contract: Contract,
	index: number,
	config: Omit<MainConfig, "paginaInicial">,
	baseUrl: string | undefined,
	itemRepository: IItensRepository,
	stats: ProcessingStats,
) {
	const url = `${baseUrl}/v1/orgaos/${contract.orgaoEntidade.cnpj}/compras/${contract.anoCompra}/${contract.sequencialCompra}/itens/${index}`;

	const response = await retryRequest<Item>(url);
	const ItemData = response.data;

	// Incrementa o total de itens retornados
	stats.totalRetornados++;

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
	const unidadeMedidaNormalizada = ItemData.unidadeMedida
		?.trim()
		.replace(/[\n\r\t\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, "")
		.toUpperCase();

	if (
		ItemData.materialOuServico === "S" ||
		servicoVariacoes.includes(unidadeMedidaNormalizada)
	) {
		logger.warn(
			`Pulando materialOuServico ${ItemData.materialOuServico} | unidadeMedida ${ItemData.unidadeMedida} | ${ItemData.descricao}`,
		);
		// Incrementa o total de itens pulados
		stats.totalPulados++;
		saveItemsToJSON({
			codigoModalidadeContratacao: config.codigoModalidadeContratacao,
			itens: [convertItemDataToOutputItem(contract, index, ItemData)],
			startDateOfProposalReceiptPeriod: config.startDateOfProposalReceiptPeriod,
			endDateOfProposalReceiptPeriod: config.endDateOfProposalReceiptPeriod,
			folderToStorage: "_itens_skipped",
		});
		return;
	}

	const item: OutputItens = convertItemDataToOutputItem(
		contract,
		index,
		ItemData,
	);

	// Armazena imediatamente o item encontrado
	await saveItemsToDatabase({ itens: itemRepository })({ itens: [item] });
	// Incrementa o total de itens gravados
	stats.totalGravados++;
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
	config: Omit<MainConfig, "paginaInicial">,
	itemRepository: IItensRepository,
	stats: ProcessingStats,
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
				stats,
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
}: MainConfig) {
	await initializeDatabase();
	logger.info("Banco de dados inicializado.");

	const itemRepository = new PostgresItensRepository();

	// Inicializa o objeto de estatísticas
	const stats: ProcessingStats = {
		totalRetornados: 0,
		totalPulados: 0,
		totalGravados: 0,
	};

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

	for (let i = paginaInicial; i <= totalPaginas; i++) {
		logger.info(`Processando página ${i} de ${totalPaginas}`);

		let pageResponse: APIResponse;
		try {
			logger.notice(`Buscando contratos da página ${i}...`);
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
				await processContract(
					contract,
					{
						codigoModalidadeContratacao,
						startDateOfProposalReceiptPeriod,
						endDateOfProposalReceiptPeriod,
						folderToStorage,
						timeDelay,
					},
					itemRepository,
					stats,
				);
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

	return stats;
}

// promptUser function to gather inputs
async function promptUser(): Promise<PromptAnswers> {
	const questions = [
		{
			type: "list",
			name: "codigoModalidadeContratacao",
			message: "Escolha a modalidade de contratação:",
			choices: Object.entries(ContractingModalityCode)
				.filter(([key]) => Number.isNaN(Number(key))) // Filter out numeric keys from enum
				.map(([key, value]) => ({ name: key, value: value })),
			default: ContractingModalityCode["Dispensa de Licitação"],
		},
		{
			type: "input",
			name: "startDateOfProposalReceiptPeriod",
			message:
				"Digite a data de INÍCIO do período de recebimento de propostas (DD-MM-YYYY):",
			validate: (input: string) => {
				const match = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
				if (!match) {
					return "Por favor, digite uma data válida no formato DD-MM-YYYY.";
				}
				const [_, day, month, year] = match;
				const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
				if (
					date.getUTCFullYear() === Number.parseInt(year, 10) &&
					date.getUTCMonth() + 1 === Number.parseInt(month, 10) &&
					date.getUTCDate() === Number.parseInt(day, 10)
				) {
					const today = new Date();
					today.setUTCHours(0, 0, 0, 0);
					if (date < today) {
						return "A data inicial não pode ser menor que a data atual.";
					}
					return true;
				}
				return "Data inválida (ex: 29/02 em ano não bissexto).";
			},
			default: (() => {
				const now = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
				const dia = now.getDate().toString().padStart(2, "0");
				const mes = (now.getMonth() + 1).toString().padStart(2, "0");
				const ano = now.getFullYear();
				return `${dia}-${mes}-${ano}`;
			})(),
		},
		{
			type: "input",
			name: "endDateOfProposalReceiptPeriod",
			message:
				"Digite a data de FIM do período de recebimento de propostas (DD-MM-YYYY):",
			validate: (input: string, answers: PromptAnswers) => {
				const match = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
				if (!match) {
					return "Por favor, digite uma data válida no formato DD-MM-YYYY.";
				}
				const [_, day, month, year] = match;
				const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
				if (
					date.getUTCFullYear() === Number.parseInt(year, 10) &&
					date.getUTCMonth() + 1 === Number.parseInt(month, 10) &&
					date.getUTCDate() === Number.parseInt(day, 10)
				) {
					const today = new Date();
					today.setUTCHours(0, 0, 0, 0);
					if (date < today) {
						return "A data final não pode ser menor que a data atual.";
					}
					const [startDay, startMonth, startYear] =
						answers.startDateOfProposalReceiptPeriod.split("-");
					const startDate = new Date(
						`${startYear}-${startMonth}-${startDay}T12:00:00Z`,
					);
					if (date < startDate) {
						return "A data final não pode ser menor que a data inicial.";
					}
					return true;
				}
				return "Data inválida.";
			},
			default: (answers: PromptAnswers) => {
				// Converte a data de início (DD-MM-YYYY) para Date
				const [day, month, year] =
					answers.startDateOfProposalReceiptPeriod.split("-");
				const startDate = new Date(`${year}-${month}-${day}T12:00:00Z`);
				// Adiciona 10 dias
				const endDate = new Date(
					startDate.getTime() + 10 * 24 * 60 * 60 * 1000,
				);
				// Formata a data para DD-MM-YYYY
				const dia = endDate.getUTCDate().toString().padStart(2, "0");
				const mes = (endDate.getUTCMonth() + 1).toString().padStart(2, "0");
				const ano = endDate.getUTCFullYear();
				return `${dia}-${mes}-${ano}`;
			},
		},
		{
			type: "input",
			name: "folderToStorage",
			message: "Pasta para armazenamento dos itens:",
			default: "_itens",
		},
		{
			type: "number",
			name: "timeDelay",
			message: "Delay entre requisições (ms):",
			default: 250,
		},
		{
			type: "number",
			name: "paginaInicial",
			message: "Página inicial:",
			default: 1,
		},
		{
			type: "input",
			name: "uf",
			message: "UF (Opcional, deixe em branco para todas):",
			default: "SP",
		},
	];

	const answers: PromptAnswers = await inquirer.prompt(questions);

	const convertToISO = (dateBr: string) => {
		const [day, month, year] = dateBr.split("-");
		return `${year}-${month}-${day}`;
	};

	return {
		codigoModalidadeContratacao: answers.codigoModalidadeContratacao,
		startDateOfProposalReceiptPeriod: convertToISO(
			answers.startDateOfProposalReceiptPeriod,
		),
		endDateOfProposalReceiptPeriod: convertToISO(
			answers.endDateOfProposalReceiptPeriod,
		),
		folderToStorage: answers.folderToStorage,
		timeDelay: answers.timeDelay,
		paginaInicial: answers.paginaInicial,
		uf: answers.uf,
	};
}

(async () => {
	try {
		const config = await promptUser();

		const inicio = Date.now();
		logger.info({ message: "Iniciando processo com as configurações", config });

		const stats = await main(config);

		logger.warn("Processo finalizado");
		logger.warn("=".repeat(60));
		logger.warn(`Total de itens retornados da API: ${stats.totalRetornados}`);
		logger.warn(`Total de itens pulados (serviços): ${stats.totalPulados}`);
		logger.warn(`Total de itens gravados: ${stats.totalGravados}`);
		logger.warn("=".repeat(60));
		const fim = Date.now();
		const duracao = fim - inicio;
		const duracaoEmMinutos = (duracao / 1000 / 60).toFixed(2);
		logger.warn(`Duração do processo: ${duracaoEmMinutos} minutos`);
		// biome-ignore lint/suspicious/noExplicitAny: <é any mesmo>
	} catch (error: any) {
		logger.error("Ocorreu um erro ao executar o processo", {
			message: error.response?.data?.message || error.message,
			code: error.code,
			status: error.status,
			stack: error.stack,
		});
	}
})();
