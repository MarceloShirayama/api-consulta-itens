import fs from "node:fs";
import { logger } from "@/shared";
import type { OutputItens } from "@/types";
import { getStoragePath } from "./get-storage-path";

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
		const { filePath } = getStoragePath(
			codigoModalidadeContratacao,
			startDateOfProposalReceiptPeriod,
			endDateOfProposalReceiptPeriod,
			folderToStorage,
			"json",
		);

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
		// biome-ignore lint/suspicious/noExplicitAny: <é any mesmo>
	} catch (error: any) {
		logger.error(
			`Unidade ${itens[0].unidade} - Compra ${itens[0].compra} - dataEncerramentoProposta ${itens[0].dataEncerramentoProposta} - Item ${itens[0].item} - Erro ao armazenar itens no arquivo JSON:`,
			{
				name: error.name,
				message: error.message,
				stack: error.stack,
			},
		);
	}
}
