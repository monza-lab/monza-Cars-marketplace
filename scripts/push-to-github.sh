#!/bin/bash
# Script para subir a GitHub
# Ejecuta: ./push-to-github.sh

echo "Subiendo a GitHub..."
echo "Se te pedirá tu usuario y token de GitHub"
echo ""

git push -u origin main

echo ""
echo "¡Listo! Revisa: https://github.com/edgarmonza/monza-bit-the-web"
