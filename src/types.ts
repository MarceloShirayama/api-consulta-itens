export type APIResponse = {
	data: Contract[];
	totalRegistros: number;
	totalPaginas: number;
	numeroPagina: number;
	paginasRestantes: number;
	empty: boolean;
};

export type Contract = {
	modoDisputaId: number;
	amparoLegal: AmparoLegal;
	dataAberturaProposta: string;
	dataEncerramentoProposta: string;
	srp: boolean;
	orgaoEntidade: OrgaoEntidade;
	anoCompra: number;
	sequencialCompra: number;
	informacaoComplementar: string;
	processo: string;
	objetoCompra: string;
	linkSistemaOrigem: string;
	justificativaPresencial?: string;
	unidadeSubRogada?: UnidadeSubRogada;
	orgaoSubRogado?: OrgaoSubRogado;
	valorTotalHomologado?: string;
	dataInclusao: string;
	dataPublicacaoPncp: string;
	dataAtualizacao: string;
	numeroCompra: string;
	unidadeOrgao: UnidadeOrgao;
	modalidadeId: number;
	linkProcessoEletronico?: string;
	dataAtualizacaoGlobal: string;
	numeroControlePNCP: string;
	tipoInstrumentoConvocatorioNome: string;
	tipoInstrumentoConvocatorioCodigo: number;
	valorTotalEstimado: number;
	modalidadeNome: string;
	modoDisputaNome: string;
	situacaoCompraId: number;
	situacaoCompraNome: string;
	usuarioNome: string;
};
export type AmparoLegal = {
	codigo: number;
	descricao: string;
	nome: string;
};
export type UnidadeOrgao = {
	ufNome: string;
	ufSigla: string;
	municipioNome: string;
	codigoUnidade: string;
	nomeUnidade: string;
	codigoIbge: string;
};
export type OrgaoEntidade = {
	cnpj: string;
	razaoSocial: string;
	poderId: string;
	esferaId: string;
};

export type OrgaoSubRogado = {
	cnpj: string;
	razaoSocial: string;
	poderId: string;
	esferaId: string;
};

export type UnidadeSubRogada = {
	codigoUnidade: string;
	nomeUnidade: string;
	codigoIbge: number;
	municipioNome: string;
	ufSigla: string;
	ufNome: string;
	usuarioNome: string;
	linkSistemaOrigem: string;
	justificativaPresencial: string;
};

export enum ContractingModalityCode {
	/*
  ● (código = 1) Leilão - Eletrônico 
● (código = 2) Diálogo Competitivo 
● (código = 3) Concurso 
● (código = 4) Concorrência - Eletrônica 
● (código = 5) Concorrência - Presencial 
● (código = 6) Pregão - Eletrônico 
● (código = 7) Pregão - Presencial 
● (código = 8) Dispensa de Licitação 
● (código = 9) Inexigibilidade 
● (código = 10) Manifestação de Interesse 
● (código = 11) Pré-qualificação 
● (código = 12) Credenciamento 
● (código = 13) Leilão - Presencial 
*/
	"Leilão - Eletrônico" = 1,
	"Diálogo Competitivo" = 2,
	Concurso = 3,
	"Concorrência - Eletrônica" = 4,
	"Concorrência - Presencial" = 5,
	"Pregão - Eletrônico" = 6,
	"Pregão - Presencial" = 7,
	"Dispensa de Licitação" = 8,
	Inexigibilidade = 9,
	"Manifestação de Interesse" = 10,
}

export type Item = {
	descricao: string;
	quantidade: number;
	valorUnitarioEstimado: number;
	valorTotal: number;
	unidadeMedida: string;
	materialOuServico: "M" | "S";
};
