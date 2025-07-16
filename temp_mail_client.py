import aiohttp

class TempMailClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    async def generate_email(self, name: str, domain: str) -> dict:
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/emails"
            payload = {"name": name, "domain": domain}
            async with session.post(url, json=payload) as response:
                response.raise_for_status()
                return await response.json()

    async def get_messages(self, email: str) -> list:
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/emails/{email}/messages"
            async with session.get(url) as response:
                response.raise_for_status()
                return await response.json()
