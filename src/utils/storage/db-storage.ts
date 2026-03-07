import type { IItensRepository } from "@/repositories/ItensRepository";
import { logger } from "@/shared";
import type { OutputItens } from "@/types";

/**
 * PersisTência no banco de dados dos itens.
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
