"""Fail when a SQL call builds its query from strings.

Usage: python3 tools/no_string_sql.py <folder>...
"""
import ast
import sys
from pathlib import Path

SQL_METHODS = {"execute", "executemany", "executescript"}


def built_from_strings(node):
    if isinstance(node, ast.JoinedStr):
        return any(isinstance(part, ast.FormattedValue) for part in node.values)
    if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Mod)):
        return True
    return isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "format"


def problems(path):
    tree = ast.parse(path.read_text(), filename=str(path))
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in SQL_METHODS
            and node.args
            and built_from_strings(node.args[0])
        ):
            yield node.lineno


def main(folders):
    found = 0
    for folder in folders:
        for path in sorted(Path(folder).rglob("*.py")):
            for line in problems(path):
                print(f"{path}:{line}: SQL built from a string. Pass the values as parameters.")
                found += 1
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ["."]))
