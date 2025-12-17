import pgPromise from "pg-promise";

const pgp = pgPromise();

// Substitua pela sua string de conexão PostgreSQL
const connectionString =
	process.env.DATABASE_URL ||
	"postgres://username:password@localhost:5432/meu_banco_de_dados";

export const db = pgp(connectionString);

export async function initializeDatabase() {
	// Cria schema se não existir
	await db.none(`CREATE SCHEMA IF NOT EXISTS licitacao;`);

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
