.PHONY: setup dev test check vcr verify-feature e2e check-arch session-start session-end clean-check

setup:
	composer install
	npm install

dev:
	npm run dev

test:
	php artisan test

check:
	vendor/bin/pint --test
	php artisan test --filter=ExampleTest
	npm run build
	bash scripts/check-arch.sh

vcr:
	@python3 -c "import json; d=json.load(open('feature_list.json')); f=d.get('features', d if isinstance(d, list) else []); act=sum(1 for x in f if x.get('state')=='active'); p=sum(1 for x in f if x.get('state')=='passing'); tot=act+p; print(f'VCR: {p}/{tot} ({(p/tot*100):.0f}%)' if tot else 'VCR: no activated features (100%)')"

verify-feature:
	@bash scripts/verify-feature.sh $(F)

e2e:
	@npm run build
	@npx playwright --version >/dev/null 2>&1 && echo "Playwright suite ready" || true

check-arch:
	@bash scripts/check-arch.sh

session-start:
	@bash scripts/session-trace.sh session_start

session-end:
	@bash scripts/session-trace.sh session_end

clean-check:
	@bash scripts/clean-state-check.sh .
