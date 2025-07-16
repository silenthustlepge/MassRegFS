#!/usr/bin/env python3
"""
Backend API Testing Script for AutoEmergent Application
Tests all backend endpoints and functionality
"""

import requests
import json
import time
import sys
from typing import Dict, Any, List

# Backend URL from the review request
BACKEND_URL = "https://d2e40730-100a-4052-8641-d9f3096c55cd.preview.emergentagent.com"

class BackendTester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.test_results = {}
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def test_get_accounts(self) -> Dict[str, Any]:
        """Test GET /api/accounts endpoint"""
        self.log("Testing GET /api/accounts endpoint...")
        
        try:
            response = self.session.get(f"{self.base_url}/api/accounts", timeout=10)
            
            result = {
                "endpoint": "GET /api/accounts",
                "status_code": response.status_code,
                "success": False,
                "response_data": None,
                "error": None,
                "details": {}
            }
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    result["response_data"] = data
                    result["success"] = True
                    result["details"]["account_count"] = len(data) if isinstance(data, list) else 0
                    result["details"]["is_array"] = isinstance(data, list)
                    
                    # Check if we have the expected account with ID 1
                    if isinstance(data, list) and len(data) > 0:
                        account_1 = next((acc for acc in data if acc.get("id") == 1), None)
                        if account_1:
                            result["details"]["has_account_id_1"] = True
                            result["details"]["account_1_email"] = account_1.get("email")
                            result["details"]["account_1_status"] = account_1.get("status")
                        else:
                            result["details"]["has_account_id_1"] = False
                    
                    self.log(f"✅ GET /api/accounts successful - returned {len(data)} accounts")
                    
                except json.JSONDecodeError as e:
                    result["error"] = f"Invalid JSON response: {str(e)}"
                    result["details"]["raw_response"] = response.text[:500]
                    self.log(f"❌ GET /api/accounts failed - invalid JSON: {str(e)}", "ERROR")
            else:
                result["error"] = f"HTTP {response.status_code}: {response.text}"
                self.log(f"❌ GET /api/accounts failed - HTTP {response.status_code}", "ERROR")
                
        except requests.exceptions.RequestException as e:
            result = {
                "endpoint": "GET /api/accounts",
                "status_code": None,
                "success": False,
                "response_data": None,
                "error": f"Request failed: {str(e)}",
                "details": {}
            }
            self.log(f"❌ GET /api/accounts failed - Request error: {str(e)}", "ERROR")
            
        return result
    
    def test_start_signups(self, count: int = 1) -> Dict[str, Any]:
        """Test POST /api/start-signups endpoint"""
        self.log(f"Testing POST /api/start-signups with count={count}...")
        
        try:
            response = self.session.post(
                f"{self.base_url}/api/start-signups?count={count}", 
                timeout=15
            )
            
            result = {
                "endpoint": f"POST /api/start-signups?count={count}",
                "status_code": response.status_code,
                "success": False,
                "response_data": None,
                "error": None,
                "details": {"count_requested": count}
            }
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    result["response_data"] = data
                    result["success"] = True
                    result["details"]["message"] = data.get("message", "")
                    
                    self.log(f"✅ POST /api/start-signups successful - {data.get('message', 'Started')}")
                    
                except json.JSONDecodeError as e:
                    result["error"] = f"Invalid JSON response: {str(e)}"
                    result["details"]["raw_response"] = response.text[:500]
                    self.log(f"❌ POST /api/start-signups failed - invalid JSON: {str(e)}", "ERROR")
            else:
                result["error"] = f"HTTP {response.status_code}: {response.text}"
                self.log(f"❌ POST /api/start-signups failed - HTTP {response.status_code}", "ERROR")
                
        except requests.exceptions.RequestException as e:
            result = {
                "endpoint": f"POST /api/start-signups?count={count}",
                "status_code": None,
                "success": False,
                "response_data": None,
                "error": f"Request failed: {str(e)}",
                "details": {"count_requested": count}
            }
            self.log(f"❌ POST /api/start-signups failed - Request error: {str(e)}", "ERROR")
            
        return result
    
    def test_verification_link(self, account_id: int = 1) -> Dict[str, Any]:
        """Test GET /api/account/{account_id}/verification-link endpoint"""
        self.log(f"Testing GET /api/account/{account_id}/verification-link...")
        
        try:
            response = self.session.get(
                f"{self.base_url}/api/account/{account_id}/verification-link", 
                timeout=10
            )
            
            result = {
                "endpoint": f"GET /api/account/{account_id}/verification-link",
                "status_code": response.status_code,
                "success": False,
                "response_data": None,
                "error": None,
                "details": {"account_id": account_id}
            }
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    result["response_data"] = data
                    result["success"] = True
                    result["details"]["has_verification_link"] = data.get("verification_link") is not None
                    result["details"]["email"] = data.get("email")
                    result["details"]["status"] = data.get("status")
                    result["details"]["message"] = data.get("message")
                    
                    self.log(f"✅ GET verification-link successful - Account: {data.get('email')}, Status: {data.get('status')}")
                    
                except json.JSONDecodeError as e:
                    result["error"] = f"Invalid JSON response: {str(e)}"
                    result["details"]["raw_response"] = response.text[:500]
                    self.log(f"❌ GET verification-link failed - invalid JSON: {str(e)}", "ERROR")
            elif response.status_code == 404:
                result["error"] = "Account not found"
                result["details"]["account_exists"] = False
                self.log(f"❌ GET verification-link failed - Account {account_id} not found", "ERROR")
            else:
                result["error"] = f"HTTP {response.status_code}: {response.text}"
                self.log(f"❌ GET verification-link failed - HTTP {response.status_code}", "ERROR")
                
        except requests.exceptions.RequestException as e:
            result = {
                "endpoint": f"GET /api/account/{account_id}/verification-link",
                "status_code": None,
                "success": False,
                "response_data": None,
                "error": f"Request failed: {str(e)}",
                "details": {"account_id": account_id}
            }
            self.log(f"❌ GET verification-link failed - Request error: {str(e)}", "ERROR")
            
        return result
    
    def test_stream_progress(self, timeout: int = 10) -> Dict[str, Any]:
        """Test GET /api/stream-progress SSE endpoint"""
        self.log("Testing GET /api/stream-progress SSE endpoint...")
        
        try:
            # Test SSE connection
            response = self.session.get(
                f"{self.base_url}/api/stream-progress",
                stream=True,
                timeout=timeout,
                headers={"Accept": "text/event-stream"}
            )
            
            result = {
                "endpoint": "GET /api/stream-progress",
                "status_code": response.status_code,
                "success": False,
                "response_data": None,
                "error": None,
                "details": {}
            }
            
            if response.status_code == 200:
                # Check if it's an SSE stream
                content_type = response.headers.get("content-type", "")
                result["details"]["content_type"] = content_type
                result["details"]["is_sse"] = "text/event-stream" in content_type
                
                # Try to read a few lines to verify it's working
                lines_read = []
                try:
                    for i, line in enumerate(response.iter_lines(decode_unicode=True)):
                        if line:
                            lines_read.append(line)
                        if i >= 5:  # Read first few lines only
                            break
                    
                    result["success"] = True
                    result["details"]["sample_lines"] = lines_read[:3]  # Store first 3 lines
                    result["details"]["lines_count"] = len(lines_read)
                    
                    self.log(f"✅ GET /api/stream-progress successful - SSE stream active")
                    
                except Exception as e:
                    result["error"] = f"Error reading SSE stream: {str(e)}"
                    self.log(f"❌ GET /api/stream-progress failed - Stream read error: {str(e)}", "ERROR")
                    
            else:
                result["error"] = f"HTTP {response.status_code}: {response.text}"
                self.log(f"❌ GET /api/stream-progress failed - HTTP {response.status_code}", "ERROR")
                
        except requests.exceptions.RequestException as e:
            result = {
                "endpoint": "GET /api/stream-progress",
                "status_code": None,
                "success": False,
                "response_data": None,
                "error": f"Request failed: {str(e)}",
                "details": {}
            }
            self.log(f"❌ GET /api/stream-progress failed - Request error: {str(e)}", "ERROR")
            
        return result
    
    def test_database_consistency(self) -> Dict[str, Any]:
        """Test database operations by comparing multiple calls"""
        self.log("Testing database consistency...")
        
        try:
            # Make two consecutive calls to /api/accounts
            response1 = self.session.get(f"{self.base_url}/api/accounts", timeout=10)
            time.sleep(1)  # Small delay
            response2 = self.session.get(f"{self.base_url}/api/accounts", timeout=10)
            
            result = {
                "endpoint": "Database consistency test",
                "status_code": response1.status_code,
                "success": False,
                "response_data": None,
                "error": None,
                "details": {}
            }
            
            if response1.status_code == 200 and response2.status_code == 200:
                try:
                    data1 = response1.json()
                    data2 = response2.json()
                    
                    result["success"] = True
                    result["details"]["first_call_count"] = len(data1) if isinstance(data1, list) else 0
                    result["details"]["second_call_count"] = len(data2) if isinstance(data2, list) else 0
                    result["details"]["consistent"] = data1 == data2
                    
                    if data1 == data2:
                        self.log("✅ Database consistency test passed - data is consistent")
                    else:
                        self.log("⚠️ Database consistency test - data changed between calls", "WARNING")
                    
                except json.JSONDecodeError as e:
                    result["error"] = f"Invalid JSON response: {str(e)}"
                    self.log(f"❌ Database consistency test failed - JSON error: {str(e)}", "ERROR")
            else:
                result["error"] = f"HTTP errors: {response1.status_code}, {response2.status_code}"
                self.log(f"❌ Database consistency test failed - HTTP errors", "ERROR")
                
        except requests.exceptions.RequestException as e:
            result = {
                "endpoint": "Database consistency test",
                "status_code": None,
                "success": False,
                "response_data": None,
                "error": f"Request failed: {str(e)}",
                "details": {}
            }
            self.log(f"❌ Database consistency test failed - Request error: {str(e)}", "ERROR")
            
        return result
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all backend tests"""
        self.log("=" * 60)
        self.log("STARTING COMPREHENSIVE BACKEND API TESTING")
        self.log("=" * 60)
        
        # Test all endpoints
        tests = [
            ("accounts", self.test_get_accounts),
            ("start_signups", lambda: self.test_start_signups(1)),
            ("verification_link", lambda: self.test_verification_link(1)),
            ("stream_progress", self.test_stream_progress),
            ("database_consistency", self.test_database_consistency)
        ]
        
        results = {}
        
        for test_name, test_func in tests:
            self.log(f"\n--- Running {test_name} test ---")
            try:
                results[test_name] = test_func()
            except Exception as e:
                self.log(f"❌ Test {test_name} crashed: {str(e)}", "ERROR")
                results[test_name] = {
                    "endpoint": test_name,
                    "status_code": None,
                    "success": False,
                    "response_data": None,
                    "error": f"Test crashed: {str(e)}",
                    "details": {}
                }
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        
        total_tests = len(results)
        passed_tests = sum(1 for r in results.values() if r["success"])
        failed_tests = total_tests - passed_tests
        
        for test_name, result in results.items():
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            self.log(f"{status} - {test_name}: {result.get('endpoint', 'N/A')}")
            if not result["success"] and result.get("error"):
                self.log(f"    Error: {result['error']}")
        
        self.log(f"\nResults: {passed_tests}/{total_tests} tests passed")
        
        return {
            "summary": {
                "total_tests": total_tests,
                "passed_tests": passed_tests,
                "failed_tests": failed_tests,
                "success_rate": (passed_tests / total_tests) * 100 if total_tests > 0 else 0
            },
            "detailed_results": results
        }

def main():
    """Main function to run backend tests"""
    print("AutoEmergent Backend API Testing")
    print(f"Testing backend at: {BACKEND_URL}")
    print()
    
    tester = BackendTester(BACKEND_URL)
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    if results["summary"]["failed_tests"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()