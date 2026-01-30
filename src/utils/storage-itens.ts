import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
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

function getFilePath(
	codigoModalidadeContratacao: number,
	startDateOfProposalReceiptPeriod: string,
	endDateOfProposalReceiptPeriod: string,
	folderToStorage: string,
	extension: string,
) {
	const noticeStoragePath = path.join(process.cwd(), folderToStorage);
	const fileName = `${codigoModalidadeContratacao === 8 ? "dispensa" : "pregao"}-itens-${formatDateToYYMMDD(startDateOfProposalReceiptPeriod)}-a-${formatDateToYYMMDD(endDateOfProposalReceiptPeriod)}.${extension}`;

	if (!fs.existsSync(noticeStoragePath)) {
		fs.mkdirSync(noticeStoragePath, { recursive: true });
	}

	return {
		noticeStoragePath,
		filePath: path.join(noticeStoragePath, fileName),
	};
}

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
		const { filePath } = getFilePath(
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
	} catch (error) {
		logger.error("Erro ao armazenar itens no arquivo JSON:", error);
	}
}

/**
 * Salva os itens em um arquivo Excel (.xlsx).
 * @param codigoModalidadeContratacao - Código da modalidade de contratação.
 * @param itens - Itens a serem armazenados.
 * @param startDateOfProposalReceiptPeriod - Data inicial do período de recebimento de propostas.
 * @param endDateOfProposalReceiptPeriod - Data final do período de recebimento de propostas.
 * @param folderToStorage - Pasta onde o arquivo Excel será armazenado.
 */
export async function saveToXLXS({
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
		const { filePath } = getFilePath(
			codigoModalidadeContratacao,
			startDateOfProposalReceiptPeriod,
			endDateOfProposalReceiptPeriod,
			folderToStorage,
			"xlsx",
		);

		const workbook = new ExcelJS.Workbook();
		let worksheet: ExcelJS.Worksheet;

		const columns = [
			{ header: "Órgão", key: "orgao", width: 30 },
			{ header: "Unidade", key: "unidade", width: 20 },
			{ header: "Município", key: "municipio", width: 20 },
			{ header: "Compra", key: "compra", width: 20 },
			{
				header: "Data Encerramento",
				key: "dataEncerramentoProposta",
				width: 15,
				style: { numFmt: "dd/mm/yy" },
			},
			{ header: "Modalidade", key: "modalidade", width: 20 },
			{ header: "Disputa", key: "disputa", width: 15 },
			{ header: "Registro Preço", key: "registroPreco", width: 10 },
			{
				header: "Item",
				key: "item",
				width: 10,
				style: { numFmt: "0" },
			},
			{ header: "Descrição", key: "descricao", width: 40 },
			{
				header: "Quantidade",
				key: "quantidade",
				width: 12,
				style: { numFmt: "0" },
			},
			{ header: "Unidade Medida", key: "unidadeMedida", width: 10 },
			{
				header: "Valor Unitário Estimado",
				key: "valorUnitarioEstimado",
				width: 20,
				style: { numFmt: "#,##0.00" },
			},
			{
				header: "Valor Total",
				key: "valorTotal",
				width: 20,
				style: { numFmt: "#,##0.00" },
			},
			{ header: "Link", key: "link", width: 50 },
		];

		if (fs.existsSync(filePath)) {
			await workbook.xlsx.readFile(filePath);
			worksheet = workbook.getWorksheet(1) || workbook.addWorksheet("Itens");
			// Re-aplica as colunas para garantir o mapeamento de chaves
			worksheet.columns = columns;
		} else {
			worksheet = workbook.addWorksheet("Itens");
			worksheet.columns = columns;
		}

		// Adiciona novos itens
		for (const item of itens) {
			// Converte data se for string
			let dataEncerramento = item.dataEncerramentoProposta;
			if (typeof dataEncerramento === "string") {
				// Tenta converter "YYYY-MM-DD" ou similar para Date
				const parsedDate = new Date(dataEncerramento);
				if (!Number.isNaN(parsedDate.getTime())) {
					dataEncerramento = parsedDate as unknown as string;
				}
			}

			worksheet.addRow({
				...item,
				dataEncerramentoProposta: dataEncerramento,
				item: Number(item.item),
				quantidade: Number(item.quantidade),
				valorUnitarioEstimado: Number(item.valorUnitarioEstimado),
				valorTotal: Number(item.valorTotal),
			});
		}

		await workbook.xlsx.writeFile(filePath);
	} catch (error) {
		logger.error("Erro ao armazenar itens no arquivo Excel:", error);
	}
}
