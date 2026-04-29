import { GetContracts } from "./src/use-cases/get-contracts";
import "./src/_config/module-alias";

async function main() {
  const getContracts = new GetContracts();
  const res = await getContracts.execute({
    codigoModalidadeContratacao: 8,
    page: 1,
    endDateOfProposalReceiptPeriod: "2026-05-31",
    uf: "SP"
  });
  console.log("Total Pages:", res.totalPaginas, "Total Registros:", res.totalRegistros);
  console.log("Dates for page 1:");
  if (res.data) {
    res.data.slice(0, 5).forEach(c => console.log(c.dataPublicacaoPncp, c.dataAtualizacaoPncp));
  }
}
main().catch(console.error);
