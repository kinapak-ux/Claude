#!/bin/sh
# Wraps the artifact fragment (scoot-city.html) into a standalone page (index.html).
cd "$(dirname "$0")"
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'; cat scoot-city.html; printf '\n</html>\n'; } > index.html
