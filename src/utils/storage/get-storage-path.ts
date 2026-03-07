import fs from "node:fs";
import path from "node:path";
import { formatDateToYYMMDD } from "@/utils/formatDateToYYMMDD";

export function getStoragePath(
	codigoModalidadeContratacao: number,
	startDateOfProposalReceiptPeriod: string,
	endDateOfProposalReceiptPeriod: string,
	folderToStorage: string,
	extension: string,
) {
	const noticeStoragePath = path.join(process.cwd(), folderToStorage);
	const suffix = codigoModalidadeContratacao === 8 ? "dispensa" : "pregao";
	const start = formatDateToYYMMDD(startDateOfProposalReceiptPeriod);
	const end = formatDateToYYMMDD(endDateOfProposalReceiptPeriod);

	const fileName = `${suffix}-itens-${start}-a-${end}.${extension}`;

	if (!fs.existsSync(noticeStoragePath)) {
		fs.mkdirSync(noticeStoragePath, { recursive: true });
	}

	return {
		noticeStoragePath,
		filePath: path.join(noticeStoragePath, fileName),
	};
}
