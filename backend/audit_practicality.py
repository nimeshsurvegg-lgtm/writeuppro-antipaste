import re

with open('backend/app/api/v1/endpoints/academic.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if line.strip().startswith('def '):
            print(f'{i+1}: {line.strip()}')
