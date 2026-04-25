import { retryRequest } from "@/lib/retryRequest";
import { logger } from "@/shared";
import type {
	Contract,
	Item,
	MainConfig,
	OutputItens,
	ProcessingStats,
} from "@/types";
import { delay, formatarData, parseBrDateToISO } from "@/utils";
import { saveItemsToJSON, saveToXLXS } from "@/utils/storage";

export class ProcessContract {
	/**
	 * Processa um contrato completo e seus itens associados.
	 */
	async execute(
		contract: Contract,
		config: Omit<MainConfig, "paginaInicial">,
		stats: ProcessingStats,
	): Promise<void> {
		logger.notice(
			`Contrato: ${contract.unidadeOrgao.nomeUnidade} - ${contract.numeroCompra}/${contract.anoCompra}`,
		);

		if (this.#shouldSkipContract(contract, config)) return;

		try {
			const items = await this.#fetchAllItems(contract, config);

			for (const itemData of items) {
				stats.totalRetornados++;
				const index = items.indexOf(itemData) + 1;
				const outputItem = this.#mapToOutputItem(contract, index, itemData);

				if (this.#isService(itemData)) {
					logger.warn(`Pulando serviço: ${itemData.descricao}`);
					stats.totalPulados++;
					const skippedParams = {
						...config,
						itens: [outputItem],
						folderToStorage: "_itens_skipped",
					};
					await saveItemsToJSON(skippedParams);
					await saveToXLXS(skippedParams);
					continue;
				}

				stats.totalGravados++;
				const storageParams = { ...config, itens: [outputItem] };
				await saveItemsToJSON(storageParams);
				await saveToXLXS(storageParams);
			}

			// Delay após processar todos os itens do contrato
			await delay(config.timeDelay);
		} catch (error: unknown) {
			logger.error(
				`Erro ao processar itens do contrato ${contract.numeroCompra}/${contract.anoCompra}`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Busca itens de um contrato usando estratégia híbrida (Lote + Individual).
	 */
	async #fetchAllItems(
		contract: Contract,
		config: Omit<MainConfig, "paginaInicial">,
	): Promise<Item[]> {
		const baseUrl = process.env.PNCP_INTEGRATION_URL;
		const bulkUrl = `${baseUrl}/v1/orgaos/${contract.orgaoEntidade.cnpj}/compras/${contract.anoCompra}/${contract.sequencialCompra}/itens`;

		// 1. Busca os primeiros itens em lote
		const response = await retryRequest<Item[]>(bulkUrl, {
			timeoutErrorMessage: `Erro ao buscar itens em lote do Contrato ${contract.numeroCompra}/${contract.anoCompra}`,
		});

		const allItems: Item[] = Array.isArray(response.data) ? response.data : [];

		// 2. Busca individual adaptativa.
		// Independentemente de quantos itens vieram no lote, sempre tentamos buscar o próximo índice.
		// Se o próximo item (allItems.length + 1) existir, continuamos a busca individualmente até o 404.
		// Isso torna o código resiliente a qualquer mudança no limite padrão da API.
		const nextIndex = allItems.length + 1;
		logger.notice(
			`Lote processado (${allItems.length} itens). Verificando continuidade do contrato a partir do item ${nextIndex}...`,
		);

		for (let index = nextIndex; index < 1000; index++) {
			try {
				const itemUrl = `${bulkUrl}/${index}`;
				const itemResponse = await retryRequest<Item>(itemUrl, {
					timeoutErrorMessage: `Erro ao buscar item individual ${index}`,
				});

				if (itemResponse.data) {
					allItems.push(itemResponse.data);
					await delay(config.timeDelay); // Delay entre requisições individuais
				} else {
					break;
				}
			} catch (error: unknown) {
				// 404 indica fim dos itens
				// biome-ignore lint/suspicious/noExplicitAny: <axios error>
				if ((error as any).response?.status === 404) break;
				throw error;
			}
		}

		return allItems;
	}

	/**
	 * Normaliza e valida se o item é um serviço.
	 */
	#isService(item: Item): boolean {
		const servicoVariacoes = [
			"SERV",
			"SRV",
			"SERVIÇO",
			"SV",
			"SERV.",
			"SERVICO",
			"SRVC",
			"SER",
		];
		const unit = item.unidadeMedida
			?.trim()
			.replace(/[\n\r\t\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, "")
			.toUpperCase();

		return item.materialOuServico === "S" || servicoVariacoes.includes(unit);
	}

	/**
	 * Converte os dados da API para o formato de saída do Excel/JSON.
	 */
	#mapToOutputItem(
		contract: Contract,
		index: number,
		itemData: Item,
	): OutputItens {
		return {
			orgao: contract.orgaoEntidade.razaoSocial.trim(),
			unidade:
				`${contract.unidadeOrgao.codigoUnidade} - ${contract.unidadeOrgao.nomeUnidade}`.trim(),
			municipio: contract.unidadeOrgao.municipioNome.trim(),
			compra: `${contract.numeroCompra}/${contract.anoCompra}`,
			dataPublicacaoPncp: formatarData(contract.dataPublicacaoPncp).trim(),
			dataEncerramentoProposta: formatarData(
				contract.dataEncerramentoProposta,
			).trim(),
			modalidade: contract.modalidadeNome.trim(),
			disputa: contract.modoDisputaNome.trim(),
			registroPreco: contract.srp ? "SIM" : "NÃO",
			item: index,
			descricao: itemData.descricao.toLowerCase().trim(),
			quantidade: itemData.quantidade,
			unidadeMedida: itemData.unidadeMedida.trim() ?? "",
			valorUnitarioEstimado: itemData.valorUnitarioEstimado,
			valorTotal: itemData.valorTotal,
			link: `https://pncp.gov.br/app/editais/${contract.orgaoEntidade.cnpj}/${contract.anoCompra}/${contract.sequencialCompra}`,
		};
	}

	#shouldSkipContract(
		contract: Contract,
		config: Omit<MainConfig, "paginaInicial">,
	): boolean {
		const closingDate = new Date(contract.dataEncerramentoProposta);
		const configStartDate = new Date(
			parseBrDateToISO(config.startDateOfProposalReceiptPeriod),
		);

		if (closingDate < configStartDate) {
			logger.warn(
				`Data de encerramento ${contract.dataEncerramentoProposta} < Início configurado. Pulando.`,
			);
			return true;
		}

		if (config.dataPublicacaoPncp) {
			const pubDate = new Date(
				parseBrDateToISO(formatarData(contract.dataPublicacaoPncp)),
			);
			const cutoffDate = new Date(parseBrDateToISO(config.dataPublicacaoPncp));
			if (pubDate < cutoffDate) {
				logger.warn(
					`Data de publicação ${formatarData(contract.dataPublicacaoPncp)} < Corte. Pulando.`,
				);
				return true;
			}
		}

		if (contract.srp === true && !config.processarSRP) {
			logger.warn("Contrato SRP - Registro de Preços. Pulando.");
			return true;
		}

		return false;
	}
}
