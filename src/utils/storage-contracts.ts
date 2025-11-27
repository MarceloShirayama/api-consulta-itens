import fs from "node:fs";
import path from "node:path";
import { logger } from "@/shared";
import type { ContractingModalityCode } from "@/types";
import type { OutputContracts } from "..";
import { formatDateAndTime } from "./formatDateAndTime";

export function storageContractsInFile({
	contracts,
	endDateOfProposalReceiptPeriod,
	folderToStorage,
}: {
	contracts: OutputContracts[];
	endDateOfProposalReceiptPeriod: string;
	folderToStorage: string;
}) {
	contracts.sort((a, b) => {
		const dateA = new Date(a.dataEncerramentoProposta).getTime();
		const dateB = new Date(b.dataEncerramentoProposta).getTime();
		return dateA - dateB;
	});
	const contractsJson = JSON.stringify(contracts, null, 2);
	const formattedDate = formatDateAndTime(new Date());
	const noticeStoragePath = path.join(process.cwd(), folderToStorage);
	const filePath = path.join(
		noticeStoragePath,
		`${formattedDate}-enc_prop${endDateOfProposalReceiptPeriod}.json`,
	);
	if (!fs.existsSync(noticeStoragePath)) {
		fs.mkdirSync(noticeStoragePath, { recursive: true });
	}
	fs.writeFileSync(filePath, contractsJson);
	logger.info(
		`Foram gravados ${contracts.length} contrato(s) no arquivo ${filePath}`,
	);
}
