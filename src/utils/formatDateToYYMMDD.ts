import { logger } from "@/shared";

export function formatDateToYYMMDD(dateStr: string) {
	try {
		const [year, month, day] = dateStr.split("-");
		if (year && month && day) {
			return `${year.slice(2)}-${month}-${day}`;
		}
		throw new Error("Data inválida");
		// biome-ignore lint/suspicious/noExplicitAny: <eu quero any mesmo>
	} catch (error: any) {
		logger.error(`Erro ao formatar data: ${dateStr} - ${error}`, error.stack);
		return "data-invalida";
	}
}
