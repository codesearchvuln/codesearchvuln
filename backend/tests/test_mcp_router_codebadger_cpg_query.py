from app.services.agent.mcp.router import MCPToolRouter


def test_router_maps_extract_function_new_contract_to_symbol_name_and_symbol():
    router = MCPToolRouter()
    route = router.route(
        "extract_function",
        {
            "code": "int validate_access(User* user) { return user != NULL; }",
            "file_name": "authz.c",
            "path": "src/authz.c",
            "line": 12,
        },
    )

    assert route is not None
    assert route.adapter_name == "__local__"
    assert route.mcp_tool_name == "extract_function"
    assert route.arguments.get("path") == "src/authz.c"
    assert route.arguments.get("symbol_name") == "validate_access"
    assert route.arguments.get("symbol") == "validate_access"
    assert route.arguments.get("line") == 12
    assert route.arguments.get("line_start") == 12
    assert "code" not in route.arguments
    assert "file_name" not in route.arguments


def test_router_preserves_extract_function_canonical_symbol_input():
    router = MCPToolRouter()
    route = router.route(
        "extract_function",
        {
            "path": "src/authz.c",
            "symbol_name": "validate_access",
            "line_start": 12,
        },
    )

    assert route is not None
    assert route.adapter_name == "__local__"
    assert route.mcp_tool_name == "extract_function"
    assert route.arguments.get("path") == "src/authz.c"
    assert route.arguments.get("symbol_name") == "validate_access"
    assert route.arguments.get("symbol") == "validate_access"
    assert route.arguments.get("line_start") == 12
