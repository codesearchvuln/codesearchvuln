import asyncio
import logging

from app.services.agent.tools.sandbox_tool import SandboxManager

# Configure logging
logging.basicConfig(level=logging.INFO)


async def main():
    print("Checking SandboxManager...")
    mgr = SandboxManager()
    await mgr.initialize()
    print(f"Is available: {mgr.is_available}")
    print(f"Diagnosis: {mgr.get_diagnosis()}")

    if mgr.is_available:
        print("Docker client created successfully.")
        try:
            ver = mgr._docker_client.version()
            print(f"Docker version: {ver}")
        except Exception as e:
            print(f"Error getting version: {e}")


if __name__ == "__main__":
    asyncio.run(main())
