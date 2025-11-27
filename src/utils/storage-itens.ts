import fs from "node:fs";
import path from "node:path";
import { logger } from "@/shared";
import type { OutputItens } from "..";

function formatDateToYYMMDD(dateStr: string) {
	try {
		const [day, month, year] = dateStr.split("-");
		if (year && month && day) {
			return `${year.slice(2)}-${month}-${day}`;
		}
		// return "Arquivo com data inválida";
		throw new Error("Data inválida");
		// biome-ignore lint/suspicious/noExplicitAny: <eu quero any mesmo>
	} catch (error: any) {
		logger.error(`Erro ao formatar data: ${dateStr} - ${error}`, error.stack);
		return "data-invalida";
	}
}

export function storageItens({
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

	// Adiciona os novos itens ao array existente
	existingItens.push(...itens);

	// Remove duplicatas baseado em todas as propriedades do item
	const uniqueItens = Array.from(
		new Map(
			existingItens.map((item) => [
				JSON.stringify(item), // serializa todas as propriedades
				item,
			]),
		).values(),
	);

	fs.writeFileSync(filePath, JSON.stringify(uniqueItens, null, 2));
	logger.info(
		`Foram gravados ${uniqueItens.length} itens no arquivo ${filePath}`,
	);
}
