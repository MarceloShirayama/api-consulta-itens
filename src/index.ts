import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { isAxiosError } from "axios";
import { logger } from "@/shared";
import type { MainConfig, ProcessingStats } from "@/types";
import { GetContracts, ProcessContract } from "@/use-cases";
import { delay } from "@/utils";
import "./_config/module-alias";
import { promptUser } from "@/cli/prompt";

const execAsync = promisify(exec);

/**
 * Orquestrador principal da consulta de itens do PNCP.
 */
async function runCollection(config: MainConfig) {
	const stats: ProcessingStats = {
		totalRetornados: 0,
		totalPulados: 0,
		totalGravados: 0,
	};

	const getContracts = new GetContracts();
	const processContract = new ProcessContract();

	// Busca inicial para obter metadados das páginas
	const response = await getContracts.execute({
		...config,
		uf: config.uf,
		page: 1,
	});

	const { totalRegistros, totalPaginas } = response;
	logger.info({ totalRegistros, totalPaginas });

	for (let i = config.paginaInicial; i <= totalPaginas; i++) {
		logger.info(`Processando página ${i} de ${totalPaginas}`);

		try {
			const pageResponse = await getContracts.execute({
				...config,
				uf: config.uf,
				page: i,
			});

			for (const contract of pageResponse.data) {
				await processContract.execute(contract, config, stats);
			}

			// Delay para evitar rate limiting da API
			await delay(config.timeDelay);
		} catch (error: unknown) {
			const msg =
				// biome-ignore lint/suspicious/noExplicitAny: <é any mesmo>
				(error as any).response?.data?.message || (error as Error).message;
			throw new Error(`Erro fatal na página ${i}: ${msg}`);
		}
	}

	return stats;
}

/**
 * Ponto de entrada da aplicação.
 */
(async () => {
	const gracefulShutdown = async (signal: string) => {
		logger.notice(`Recebido sinal ${signal}. Encerrando processo...`);
		process.exit(0);
	};

	process.on("SIGINT", () => gracefulShutdown("SIGINT"));
	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

	try {
		const config = await promptUser();
		const startTime = Date.now();

		logger.info({ message: "Iniciando consulta", config });

		const stats = await runCollection(config);

		logFinalStats(stats, startTime, config);

		await openStorageFolder(config.folderToStorage);
	} catch (error: unknown) {
		const message = isAxiosError(error)
			? error.response?.data?.message
			: (error as Error).message;
		logger.error("Falha na execução do processo", {
			message,
			stack: (error as Error).stack,
		});
	}
})();

function logFinalStats(
	stats: ProcessingStats,
	startTime: Date | number,
	config: MainConfig,
) {
	const duration = ((Date.now() - Number(startTime)) / 1000 / 60).toFixed(2);

	logger.warn("=".repeat(60));
	logger.warn(
		`Data Inicial de Publicação dos Contratos: ${config.dataPublicacaoPncp}`,
	);
	logger.warn(
		`Data do Contratos Consultados: de ${config.startDateOfProposalReceiptPeriod} até ${config.endDateOfProposalReceiptPeriod}`,
	);
	logger.warn(`UF: ${config.uf}`);
	logger.warn(
		`Processados Registros de Preços: ${config.processarSRP ? "SIM" : "NÃO"}`,
	);
	logger.warn(
		`Modalidade de Contratação: ${config.codigoModalidadeContratacao}`,
	);
	logger.warn(`Total Retornados: ${stats.totalRetornados}`);
	logger.warn(`Total Pulados:    ${stats.totalPulados}`);
	logger.warn(`Total Gravados:   ${stats.totalGravados}`);
	logger.warn(`Duração:          ${duration} minutos`);
	logger.warn("=".repeat(60));
}

async function openStorageFolder(folder: string) {
	try {
		const absolutePath = path.resolve(folder);
		logger.notice(`Abrindo pasta: ${folder}`);
		await execAsync("explorer.exe .", { cwd: absolutePath }).catch(() => {});
	} catch (error) {
		logger.error("Erro ao abrir pasta no Explorer:", error);
	}
}
