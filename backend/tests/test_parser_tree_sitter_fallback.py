import logging

from app.services.parser import TreeSitterParser


def test_tree_sitter_missing_dependency_warning_emitted_once(monkeypatch, caplog):
    parser = TreeSitterParser()

    TreeSitterParser._missing_dependency_warned = False
    monkeypatch.setattr(
        TreeSitterParser,
        "_get_parser_factory",
        classmethod(lambda cls: None),
    )

    with caplog.at_level(logging.WARNING):
        assert parser.parse("x = 1", "python") is None
        assert parser.parse("function x() {}", "javascript") is None

    messages = [
        record.getMessage()
        for record in caplog.records
        if "tree-sitter python bindings not installed" in record.getMessage()
    ]
    assert len(messages) == 1
