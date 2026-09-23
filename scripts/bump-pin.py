import json, os

p = "package.json"
pkg = json.load(open(p))
version = os.environ["SDK_VERSION"]
for section in ("dependencies", "devDependencies", "peerDependencies"):
    deps = pkg.get(section, {})
    for name in ("@opencode/plugin", "@opencode/sdk", "@opencode/theme"):
        if name in deps:
            deps[name] = version
base, n = pkg["version"].split("alpha.")
pkg["version"] = base + "alpha." + str(int(n) + 1)
json.dump(pkg, open(p, "w"), indent=2)
open(p, "a").write("\n")
print("bumped", p, "to", pkg["version"])
