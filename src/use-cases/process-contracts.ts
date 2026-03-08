import { isAxiosError } from "axios";
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

		for (let index = 1; index < 1000; index++) {
			try {
				await this.#fetchAndProcessItem(contract, index, config, stats);
				await delay(config.timeDelay);
			} catch (error: unknown) {
				if (isAxiosError(error) && error.response?.status === 404) break;
				throw error;
			}
		}
	}

	/**
	 * Busca e processa um item individual.
	 */
	async #fetchAndProcessItem(
		contract: Contract,
		index: number,
		config: Omit<MainConfig, "paginaInicial">,
		stats: ProcessingStats,
	): Promise<void> {
		const baseUrl = process.env.PNCP_INTEGRATION_URL;
		const url = `${baseUrl}/v1/orgaos/${contract.orgaoEntidade.cnpj}/compras/${contract.anoCompra}/${contract.sequencialCompra}/itens/${index}`;

		const response = await retryRequest<Item>(url, {
			timeoutErrorMessage: `Erro ao buscar item ${index} - Contrato ${contract.numeroCompra}/${contract.anoCompra}`,
		});

		const itemData = response.data;
		stats.totalRetornados++;

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
			return;
		}

		stats.totalGravados++;
		const storageParams = { ...config, itens: [outputItem] };
		await saveItemsToJSON(storageParams);
		await saveToXLXS(storageParams);
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
