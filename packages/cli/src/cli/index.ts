import { cac } from "cac"
import { registerBuildCommand } from "./commands/build"
import { registerDeployCommand } from "./commands/deploy"
import { registerDevCommand } from "./commands/dev"
import { registerNewCommand } from "./commands/new"
import { registerRecacheCommand } from "./commands/recache"
import { getPackageInfo } from "./lib/package"

const pkg = getPackageInfo()

const cli = cac("gittydocs")
cli.version(pkg.version ?? "0.0.0")

registerNewCommand(cli)
registerDevCommand(cli)
registerBuildCommand(cli)
registerDeployCommand(cli)
registerRecacheCommand(cli)

cli.help()

if (process.argv.length <= 2) {
  cli.outputHelp()
} else {
  cli.parse()
}
