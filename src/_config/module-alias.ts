import { join } from "node:path";
import moduleAlias from "module-alias";

moduleAlias.addAliases({
	"@": join(__dirname, ".."),
});
