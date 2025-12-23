import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/database";
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

export async function storageItens({
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
		// Armazenar no banco
		for (const item of itens) {
			await db.none(
				`
				INSERT INTO licitacao.itens (
					orgao, unidade, municipio, compra, data_encerramento_proposta,
					modalidade, disputa, registro_preco, item, descricao,
					quantidade, unidade_medida, valor_unitario_estimado, valor_total, link,
					valor_contratado, observacoes, data_empenho, numero_empenho, data_entrega,
					data_pagamento, data_previsao_pagamento, numero_nf_venda, status_compra
				) VALUES (
					$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
					$16, $17, $18, $19, $20, $21, $22, $23, $24
				)
				ON CONFLICT (orgao, compra, modalidade, item)
				DO UPDATE SET
					unidade = EXCLUDED.unidade,
					municipio = EXCLUDED.municipio,
					data_encerramento_proposta = EXCLUDED.data_encerramento_proposta,
					disputa = EXCLUDED.disputa,
					registro_preco = EXCLUDED.registro_preco,
					descricao = EXCLUDED.descricao,
					quantidade = EXCLUDED.quantidade,
					unidade_medida = EXCLUDED.unidade_medida,
					valor_unitario_estimado = EXCLUDED.valor_unitario_estimado,
					valor_total = EXCLUDED.valor_total,
					link = EXCLUDED.link,
					valor_contratado = EXCLUDED.valor_contratado,
					observacoes = EXCLUDED.observacoes,
					data_empenho = EXCLUDED.data_empenho,
					numero_empenho = EXCLUDED.numero_empenho,
					data_entrega = EXCLUDED.data_entrega,
					data_pagamento = EXCLUDED.data_pagamento,
					data_previsao_pagamento = EXCLUDED.data_previsao_pagamento,
					numero_nf_venda = EXCLUDED.numero_nf_venda,
					status_compra = COALESCE(EXCLUDED.status_compra, 'NAO_PARTICIPAMOS'),
					updated_at = CURRENT_TIMESTAMP
			`,
				[
					item.orgao,
					item.unidade,
					item.municipio,
					item.compra,
					item.dataEncerramentoProposta,
					item.modalidade,
					item.disputa,
					item.registroPreco,
					item.item,
					item.descricao,
					item.quantidade,
					item.unidadeMedida,
					item.valorUnitarioEstimado,
					item.valorTotal,
					item.link,
					item.valorContratado || null,
					item.observacoes || null,
					item.dataEmpenho || null,
					item.numeroEmpenho || null,
					item.dataEntrega || null,
					item.dataPagamento || null,
					item.dataPrevisaoPagamento || null,
					item.numeroNfVenda || null,
					item.statusCompra || "NAO_PARTICIPAMOS",
				],
			);
			logger.info(`Item ${item.item} armazenado no banco de dados.`);
		}

		// Criar JSON como antes
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
		// logger.info(
		// 	`Foram gravados ${uniqueItens.length} itens no arquivo ${filePath}`,
		// );
	} catch (error) {
		logger.error("Erro ao armazenar itens:", error);
		throw error;
	}
}
