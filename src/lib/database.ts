import pgPromise from "pg-promise";

export const pgp = pgPromise();

// Substitua pela sua string de conexão PostgreSQL
const connectionString =
	process.env.DATABASE_URL ||
	"postgres://username:password@localhost:5432/meu_banco_de_dados";

export const db = pgp(connectionString);

export async function closeDatabase() {
	await pgp.end();
}

export async function initializeDatabase() {
	// Cria schema se não existir
	await db.none(`CREATE SCHEMA IF NOT EXISTS licitacao;`);

	// Cria tipo enum para status_compra
	await db.none(`
		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'status_compra_enum' AND n.nspname = 'licitacao') THEN
				CREATE TYPE licitacao.status_compra_enum AS ENUM ('HABILITADO', 'HOMOLOGADO', 'EM_ANALISE', 'PROPOSTA', 'PROPOSTA_ACEITA', 'DISPUTA', 'EM_ENTREGA', 'EM_PAGTO', 'PAGO', 'NAO_GANHAMOS', 'NAO_PARTICIPAMOS', 'EM_RECURSO');
			END IF;
		END $$;
	`);

	// Cria tabela para contratos (opcional, mas útil para integridade)
	await db.none(`
		CREATE TABLE IF NOT EXISTS licitacao.contratos (
			id SERIAL PRIMARY KEY,
			orgao_entidade TEXT NOT NULL,
			cnpj TEXT NOT NULL,
			nome_unidade TEXT NOT NULL,
			municipio_nome TEXT NOT NULL,
			ano_compra INTEGER NOT NULL,
			sequencial_compra INTEGER NOT NULL,
			modalidade_nome TEXT NOT NULL,
			modo_disputa_nome TEXT NOT NULL,
			registro_de_preco TEXT NOT NULL,
			data_abertura_proposta TEXT NOT NULL,
			data_encerramento_proposta TEXT NOT NULL,
			UNIQUE(orgao_entidade, ano_compra, sequencial_compra, modalidade_nome)
		);
	`);

	// Cria tabela para itens
	await db.none(`
		CREATE TABLE IF NOT EXISTS licitacao.itens (
			id SERIAL PRIMARY KEY,
			orgao TEXT NOT NULL,
			unidade TEXT NOT NULL,
			municipio TEXT NOT NULL,
			compra TEXT NOT NULL,
			data_encerramento_proposta DATE NOT NULL,
			modalidade TEXT NOT NULL,
			disputa TEXT NOT NULL,
			registro_preco TEXT NOT NULL,
			item INTEGER NOT NULL,
			descricao TEXT NOT NULL,
			quantidade INTEGER NOT NULL,
			unidade_medida TEXT NOT NULL,
			valor_unitario_estimado DECIMAL(15,4) NOT NULL,
			valor_total DECIMAL(15,4) NOT NULL,
			link TEXT NOT NULL,
			valor_contratado DECIMAL(15,4),
			observacoes TEXT,
			data_empenho DATE,
			numero_empenho TEXT,
			data_entrega DATE,
			data_pagamento DATE,
			data_previsao_pagamento DATE,
			numero_nf_venda TEXT,
			status_compra licitacao.status_compra_enum DEFAULT 'NAO_PARTICIPAMOS',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(orgao, compra, modalidade, item)
		);
	`);

	// Trigger para atualizar updated_at automaticamente
	await db.none(`
		CREATE OR REPLACE FUNCTION licitacao.update_updated_at_column()
		RETURNS TRIGGER AS $$
		BEGIN
			NEW.updated_at = CURRENT_TIMESTAMP;
			RETURN NEW;
		END;
		$$ language 'plpgsql';
	`);

	await db.none(`
		DROP TRIGGER IF EXISTS update_itens_updated_at ON licitacao.itens;
		CREATE TRIGGER update_itens_updated_at
			BEFORE UPDATE ON licitacao.itens
			FOR EACH ROW EXECUTE FUNCTION licitacao.update_updated_at_column();
	`);
}
