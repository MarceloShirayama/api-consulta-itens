import fs from "node:fs";
import path from "node:path";
import type { IItensRepository } from "@/repositories/ItensRepository";
import { logger } from "@/shared";
import type { OutputItens } from "@/types";
import { formatDateToYYMMDD } from "@/utils/formatDateToYYMMDD";

export async function saveItemsToDatabase(
	itens: OutputItens[],
	itensRepository: IItensRepository,
) {
	try {
		for (const item of itens) {
			await itensRepository.upsertItem(item);
			logger.info(`Item ${item.item} armazenado no banco de dados.`);
		}
	} catch (error) {
		logger.error("Erro ao armazenar itens no banco de dados:", error);
		throw error;
	}
}

export async function saveItemsToJSON({
	codigoModalidadeContratacao,
	itens,
	startDateOfProposalReceiptPeriod,
	endDateOfProposalReceiptPeriod,
	folderToStorage,
}: {
	codigoModalidadeContratacao: number;
	itens: OutputItens[];
	startDateOfProposalReceiptPeriod: string;
	endDateOfProposalReceiptPeriod: string;
	folderToStorage: string;
}) {
	try {
		const noticeStoragePath = path.join(process.cwd(), folderToStorage);
		const filePath = path.join(
			noticeStoragePath,
			`${codigoModalidadeContratacao === 8 ? "dispensa" : "pregao"}-itens-${formatDateToYYMMDD(startDateOfProposalReceiptPeriod)}-a-${formatDateToYYMMDD(endDateOfProposalReceiptPeriod)}.json`,
		);

		if (!fs.existsSync(noticeStoragePath)) {
			fs.mkdirSync(noticeStoragePath, { recursive: true });
		}

		let existingItens: OutputItens[] = [];
		if (fs.existsSync(filePath)) {
			const fileContent = fs.readFileSync(filePath, "utf-8");
			try {
				existingItens = JSON.parse(fileContent);
			} catch {
				logger.warn(
					`Arquivo existente corrompido ou vazio, sobrescrevendo: ${filePath}`,
				);
			}
		}

		existingItens.push(...itens);

		const uniqueItens = Array.from(
			new Map(
				existingItens.map((item) => [JSON.stringify(item), item]),
			).values(),
		);

		fs.writeFileSync(filePath, JSON.stringify(uniqueItens, null, 2));
		// logger.info(
		// 	`Foram gravados ${uniqueItens.length} itens no arquivo ${filePath}`,
		// );
	} catch (error) {
		logger.error("Erro ao armazenar itens no arquivo JSON:", error);
		// Não lançar erro aqui para não parar o processo se apenas o backup JSON falhar
	}
}

import { PostgresItensRepository } from "@/repositories/ItensRepository";

// Manter a função original por compatibilidade (opcional, mas recomendada se usada em outros lugares)
// Ou removê-la se tiver certeza que só é usada no index.ts
export async function storageItens(params: {
	codigoModalidadeContratacao: number;
	itens: OutputItens[];
	startDateOfProposalReceiptPeriod: string;
	endDateOfProposalReceiptPeriod: string;
	folderToStorage: string;
}) {
	const repo = new PostgresItensRepository();
	// Chama as duas novas funções
	await saveItemsToDatabase(params.itens, repo);
	await saveItemsToJSON(params);
}
