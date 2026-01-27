import { db } from "@/lib/database";
import type { OutputItens } from "@/types";

export interface IItensRepository {
	upsertItem(item: OutputItens): Promise<void>;
}

export class PostgresItensRepository implements IItensRepository {
	async upsertItem(item: OutputItens): Promise<void> {
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
	}
}
