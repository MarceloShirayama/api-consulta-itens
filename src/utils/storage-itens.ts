import fs from "node:fs";
import path from "node:path";
import type { IItensRepository } from "@/repositories/ItensRepository";
import { logger } from "@/shared";
import type { OutputItens } from "@/types";
import { formatDateToYYMMDD } from "@/utils/formatDateToYYMMDD";

/**
 * Salva os itens no banco de dados.
 * @param repositories - Repositórios necessários para a operação.
 * @param params - Parâmetros da operação.
 * @param params.itens - Itens a serem armazenados.
 */
export const saveItemsToDatabase =
	(repositories: { itens: IItensRepository }) =>
	async (params: { itens: OutputItens[] }) => {
		try {
			for (const item of params.itens) {
				await repositories.itens.upsertItem(item);
				logger.info(`Item ${item.item} armazenado no banco de dados.`);
			}
		} catch (error) {
			logger.error("Erro ao armazenar itens no banco de dados:", error);
			throw error;
		}
	};

/**
 * Salva os itens em um arquivo JSON.
 * @param codigoModalidadeContratacao - Código da modalidade de contratação.
 * @param itens - Itens a serem armazenados.
 * @param startDateOfProposalReceiptPeriod - Data inicial do período de recebimento de propostas.
 * @param endDateOfProposalReceiptPeriod - Data final do período de recebimento de propostas.
 * @param folderToStorage - Pasta onde o arquivo JSON será armazenado.
 */
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
