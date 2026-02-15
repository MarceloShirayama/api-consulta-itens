# Alterações necessárias:

1-   [ ] colocar a data de publicação no parametro de entrada logo após codigo Modalidade Contratacao

2-   [ ] colocar a data de encerramento no parametro de entrada default como 31-12-2050, mas comente o código já feito para que se eu quiser voltar a usar o código que já tinha feito eu possa usar.

3-   [ ] verificar a data de atualização do contrato e se ela for maior que a data de publicação, então mesmo que a data de publicação seja menor que a data inserida nos parametros de entrada o contrato deve ser processado. Mas essa condição ainda tenho que verificar como fazer para manipular os contratos salvos, pois nas planilhas criadas eu excluo os duplicados mais recentes salvos e portanto irei excluir os contratos com data de atualização maior que a data de publicação. Acho que eu poderia colocar a data de atualização na saída dos itens salvos e portanto aí o contrato não vai ser excluído, mas vão ficar 2 ítens duplicados com a data de atualização mais recente e a data de publicação mais antiga e isso vai ser um problema.
