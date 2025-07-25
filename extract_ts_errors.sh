#!/bin/bash
npm run typecheck 2>&1 | grep "error TS" | head -50