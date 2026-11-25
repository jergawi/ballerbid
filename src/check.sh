#!/bin/sh
# code checks: formatting (prettier) and static analysis (eslint) on the bundled script
# usage: BB_NPM=/path/to/node_modules sh check.sh
set -e
cd "$(dirname "$0")"
N=${BB_NPM:-node_modules}
"$N/.bin/prettier" --config .prettierrc.json --check *.js style4.css
python3 bundle2.py >/dev/null
python3 -c "import re;h=open('dist2/index.html').read();open('dist2/bundle.js','w').write(re.findall(r'<script>(.*?)</script>',h,re.S)[-1])"
"$N/.bin/eslint" -c eslint.config.mjs dist2/bundle.js
echo "checks passed"
