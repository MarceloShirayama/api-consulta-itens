export function parseBrDateToISO(dateBr: string): string {
	const [dia, mes, ano] = dateBr.split("-");
	return `${ano}-${mes}-${dia}T00:00:00`;
}
