import fs from "node:fs";
import ExcelJS from "exceljs";
import { logger } from "@/shared";
import type { OutputItens } from "@/types";
import { getStoragePath } from "./get-storage-path";

const columns = [
	{ header: "Órgão", key: "orgao", width: 30 },
	{ header: "Unidade", key: "unidade", width: 20 },
	{ header: "Município", key: "municipio", width: 20 },
	{ header: "Compra", key: "compra", width: 20 },
	{
		header: "Data Publicação PNCP",
		key: "dataPublicacaoPncp",
		width: 20,
		style: { numFmt: "dd/mm/yy" },
	},
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

/**
 * Persistência dos itens em planilha (.xlsx).
 * @param param0
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
		const { filePath } = getStoragePath(
			codigoModalidadeContratacao,
			startDateOfProposalReceiptPeriod,
			endDateOfProposalReceiptPeriod,
			folderToStorage,
			"xlsx",
		);

		const workbook = new ExcelJS.Workbook();
		let worksheet: ExcelJS.Worksheet;

		if (fs.existsSync(filePath)) {
			try {
				await workbook.xlsx.readFile(filePath);
				worksheet = workbook.getWorksheet(1) || workbook.addWorksheet("Itens");
				// Re-aplica as colunas para garantir o mapeamento de chaves
				worksheet.columns = columns;
			} catch {
				logger.warn(
					`Arquivo Excel corrompido ou vazio, iniciando novo: ${filePath}`,
				);
				worksheet = workbook.addWorksheet("Itens");
				worksheet.columns = columns;
			}
		} else {
			worksheet = workbook.addWorksheet("Itens");
			worksheet.columns = columns;
		}

		// Adiciona novos itens
		for (const item of itens) {
			// Converte data se for string
			let dataPublicacao = item.dataPublicacaoPncp;
			let dataEncerramento = item.dataEncerramentoProposta;
			if (typeof dataEncerramento === "string") {
				// Tenta converter "YYYY-MM-DD" ou similar para Date
				const parsedDate = new Date(dataEncerramento);
				if (!Number.isNaN(parsedDate.getTime())) {
					dataEncerramento = parsedDate as unknown as string;
				}
			}
			if (typeof dataPublicacao === "string") {
				// Tenta converter "YYYY-MM-DD" ou similar para Date
				const parsedDate = new Date(dataPublicacao);
				if (!Number.isNaN(parsedDate.getTime())) {
					dataPublicacao = parsedDate as unknown as string;
				}
			}

			worksheet.addRow({
				...item,
				dataPublicacaoPncp: dataPublicacao,
				dataEncerramentoProposta: dataEncerramento,
				item: Number(item.item),
				quantidade: Number(item.quantidade),
				valorUnitarioEstimado: Number(item.valorUnitarioEstimado),
				valorTotal: Number(item.valorTotal),
			});
		}

		await workbook.xlsx.writeFile(filePath);
		// biome-ignore lint/suspicious/noExplicitAny: <é any mesmo>
	} catch (error: any) {
		logger.error(
			`Unidade ${itens[0].unidade} - Compra ${itens[0].compra} - dataEncerramentoProposta ${itens[0].dataEncerramentoProposta} - Item ${itens[0].item} - Erro ao armazenar itens no arquivo Excel:`,
			{
				name: error.name,
				message: error.message,
				stack: error.stack,
			},
		);
	}
}
