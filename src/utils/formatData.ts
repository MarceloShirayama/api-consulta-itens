export function formatarData(dataIso: string): string {
	const [ano, mes, dia] = dataIso.split("T")[0].split("-");
	return `${ano}-${mes}-${dia}`;
}
