#!/usr/bin/env python3
"""
Service Alert Feature Validation Script
Checks for common implementation issues and validates the complete feature
"""

import os
import sys
import json
import re
from pathlib import Path

class ServiceAlertValidator:
    """Validator for Service Alert feature implementation"""
    
    def __init__(self, repo_path="."):
        self.repo_path = Path(repo_path)
        self.issues = []
        self.warnings = []
        self.successes = []
        
    def validate_all(self):
        """Run all validation checks"""
        print("🔍 Service Alert Feature Validation")
        print("=" * 60)
        
        # Backend validation
        self.validate_backend_structure()
        self.validate_api_endpoints()
        self.validate_database_model()
        self.validate_service_layer()
        
        # Frontend validation
        self.validate_frontend_structure()
        self.validate_react_components()
        self.validate_service_integration()
        self.validate_ui_integration()
        
        # Integration validation
        self.validate_authentication_flow()
        self.validate_error_handling()
        self.validate_performance_considerations()
        
        # Report results
        self.print_report()
        
        return len(self.issues) == 0
    
    def validate_backend_structure(self):
        """Validate backend file structure and imports"""
        print("\n📁 Validating Backend Structure...")
        
        required_files = [
            "backend/app/models/service_alert_model.py",
            "backend/app/schemas/service_alert_schema.py",
            "backend/app/services/service_alert_service.py",
            "backend/app/api/api_v1/handlers/service_alert.py"
        ]
        
        for file_path in required_files:
            full_path = self.repo_path / file_path
            if not full_path.exists():
                self.issues.append(f"❌ Missing required file: {file_path}")
            else:
                self.successes.append(f"✅ Found {file_path}")
                
                # Check file is not empty
                if full_path.stat().st_size == 0:
                    self.issues.append(f"❌ File is empty: {file_path}")
                
                # Check for syntax errors
                if file_path.endswith('.py'):
                    try:
                        compile(full_path.read_text(), file_path, 'exec')
                    except SyntaxError as e:
                        self.issues.append(f"❌ Syntax error in {file_path}: {e}")
        
        # Check model registration
        init_file = self.repo_path / "backend/app/models/__init__.py"
        if init_file.exists():
            content = init_file.read_text()
            if "ServiceAlert" not in content:
                self.issues.append("❌ ServiceAlert not imported in models/__init__.py")
            else:
                self.successes.append("✅ ServiceAlert registered in models")
        
        # Check router registration
        router_file = self.repo_path / "backend/app/api/api_v1/router.py"
        if router_file.exists():
            content = router_file.read_text()
            if "service_alert_router" not in content:
                self.issues.append("❌ service_alert_router not registered in API router")
            else:
                self.successes.append("✅ Service alert router registered")
    
    def validate_api_endpoints(self):
        """Validate API endpoint definitions"""
        print("\n🔌 Validating API Endpoints...")
        
        handler_file = self.repo_path / "backend/app/api/api_v1/handlers/service_alert.py"
        if not handler_file.exists():
            return
        
        content = handler_file.read_text()
        
        required_endpoints = [
            ("POST", "/", "create_service_alert"),
            ("GET", "/customer/{customer_phone}", "get_customer_alerts"),
            ("GET", "/customer/{customer_phone}/count", "get_customer_alert_count"),
            ("GET", "/{alert_id}", "get_service_alert"),
            ("PUT", "/{alert_id}", "update_service_alert"),
            ("PUT", "/{alert_id}/resolve", "resolve_service_alert"),
            ("PUT", "/customer/{customer_phone}/resolve-all", "resolve_all_customer_alerts"),
            ("GET", "/customer/{customer_phone}/items", "get_customer_items"),
            ("DELETE", "/{alert_id}", "delete_service_alert")
        ]
        
        for method, path, function_name in required_endpoints:
            pattern = f'@.*\\.{method.lower()}\\s*\\(.*"{path}"'
            if not re.search(pattern, content, re.IGNORECASE):
                self.issues.append(f"❌ Missing {method} {path} endpoint")
            else:
                self.successes.append(f"✅ Found {method} {path} endpoint")
                
            # Check function exists
            if f"async def {function_name}" not in content:
                self.issues.append(f"❌ Missing function: {function_name}")
    
    def validate_database_model(self):
        """Validate database model structure"""
        print("\n🗄️ Validating Database Model...")
        
        model_file = self.repo_path / "backend/app/models/service_alert_model.py"
        if not model_file.exists():
            return
        
        content = model_file.read_text()
        
        # Check enums
        required_enums = ["AlertType", "AlertPriority", "AlertStatus"]
        for enum in required_enums:
            if f"class {enum}" not in content:
                self.issues.append(f"❌ Missing enum: {enum}")
            else:
                self.successes.append(f"✅ Found enum: {enum}")
        
        # Check model fields
        required_fields = [
            "customer_phone",
            "alert_type", 
            "priority",
            "title",
            "description",
            "item_reference",
            "status",
            "created_at",
            "created_by",
            "resolved_at",
            "resolved_by",
            "resolution_notes"
        ]
        
        for field in required_fields:
            if f"{field}:" not in content and f"{field} =" not in content:
                self.issues.append(f"❌ Missing model field: {field}")
        
        # Check indexes
        if "indexes =" in content:
            if "customer_phone" not in content[content.find("indexes ="):]:
                self.warnings.append("⚠️ Missing index on customer_phone field")
    
    def validate_service_layer(self):
        """Validate service layer implementation"""
        print("\n⚙️ Validating Service Layer...")
        
        service_file = self.repo_path / "backend/app/services/service_alert_service.py"
        if not service_file.exists():
            return
        
        content = service_file.read_text()
        
        required_methods = [
            "create_alert",
            "get_customer_alerts",
            "get_customer_alert_count",
            "get_alert_by_id",
            "update_alert",
            "resolve_alert",
            "resolve_all_customer_alerts",
            "get_customer_items",
            "delete_alert"
        ]
        
        for method in required_methods:
            if f"async def {method}" not in content:
                self.issues.append(f"❌ Missing service method: {method}")
            else:
                self.successes.append(f"✅ Found service method: {method}")
        
        # Check error handling
        if "ValidationError" not in content:
            self.warnings.append("⚠️ No ValidationError handling in service")
        if "NotFoundError" not in content:
            self.warnings.append("⚠️ No NotFoundError handling in service")
    
    def validate_frontend_structure(self):
        """Validate frontend file structure"""
        print("\n📁 Validating Frontend Structure...")
        
        required_files = [
            "frontend/src/services/serviceAlertService.js",
            "frontend/src/components/customer/AlertBellAction.jsx",
            "frontend/src/components/customer/ServiceAlertDialog.jsx"
        ]
        
        for file_path in required_files:
            full_path = self.repo_path / file_path
            if not full_path.exists():
                self.issues.append(f"❌ Missing required file: {file_path}")
            else:
                self.successes.append(f"✅ Found {file_path}")
                
                # Check file is not empty
                if full_path.stat().st_size == 0:
                    self.issues.append(f"❌ File is empty: {file_path}")
    
    def validate_react_components(self):
        """Validate React component implementation"""
        print("\n⚛️ Validating React Components...")
        
        # Check AlertBellAction component
        bell_file = self.repo_path / "frontend/src/components/customer/AlertBellAction.jsx"
        if bell_file.exists():
            content = bell_file.read_text()
            
            # Check essential features
            if "useState" not in content:
                self.issues.append("❌ AlertBellAction missing state management")
            if "useEffect" not in content:
                self.issues.append("❌ AlertBellAction missing useEffect for data fetching")
            if "getCustomerAlertCount" not in content:
                self.issues.append("❌ AlertBellAction not fetching alert count")
            if "badge" not in content.lower() and "span" not in content:
                self.warnings.append("⚠️ AlertBellAction might be missing badge display")
            
            self.successes.append("✅ AlertBellAction component structure validated")
        
        # Check ServiceAlertDialog component
        dialog_file = self.repo_path / "frontend/src/components/customer/ServiceAlertDialog.jsx"
        if dialog_file.exists():
            content = dialog_file.read_text()
            
            # Check essential features
            if "Dialog" not in content:
                self.issues.append("❌ ServiceAlertDialog not using Dialog component")
            if "form" not in content.lower():
                self.issues.append("❌ ServiceAlertDialog missing form for alert creation")
            if "resolveAlert" not in content:
                self.issues.append("❌ ServiceAlertDialog missing resolve functionality")
            
            self.successes.append("✅ ServiceAlertDialog component structure validated")
    
    def validate_service_integration(self):
        """Validate frontend service integration"""
        print("\n🔗 Validating Service Integration...")
        
        service_file = self.repo_path / "frontend/src/services/serviceAlertService.js"
        if not service_file.exists():
            return
        
        content = service_file.read_text()
        
        required_methods = [
            "createAlert",
            "getCustomerAlerts",
            "getCustomerAlertCount",
            "getAlert",
            "updateAlert",
            "resolveAlert",
            "resolveAllCustomerAlerts",
            "getCustomerItems",
            "deleteAlert"
        ]
        
        for method in required_methods:
            if f"{method}" not in content:
                self.issues.append(f"❌ Missing service method: {method}")
            else:
                self.successes.append(f"✅ Found service method: {method}")
        
        # Check authentication
        if "Authorization" not in content:
            self.issues.append("❌ Service missing Authorization header")
        
        # Check error handling
        if "catch" not in content:
            self.warnings.append("⚠️ Service might be missing error handling")
    
    def validate_ui_integration(self):
        """Validate UI integration in customer management"""
        print("\n🎨 Validating UI Integration...")
        
        customer_mgmt_file = self.repo_path / "frontend/src/components/customer/EnhancedCustomerManagement.jsx"
        if customer_mgmt_file.exists():
            content = customer_mgmt_file.read_text()
            
            # Check imports
            if "AlertBellAction" not in content:
                self.issues.append("❌ AlertBellAction not imported in customer management")
            if "ServiceAlertDialog" not in content:
                self.issues.append("❌ ServiceAlertDialog not imported in customer management")
            
            # Check bell placement between Eye and MoreHorizontal
            if "<Eye" in content and "<AlertBellAction" in content and "<DropdownMenu" in content:
                eye_pos = content.find("<Eye")
                bell_pos = content.find("<AlertBellAction")
                menu_pos = content.find("<DropdownMenu", eye_pos)
                
                if eye_pos < bell_pos < menu_pos:
                    self.successes.append("✅ Bell icon correctly placed between Eye and Menu")
                else:
                    self.issues.append("❌ Bell icon not correctly placed in Actions column")
            
            # Check handlers
            if "handleBellClick" not in content:
                self.issues.append("❌ Missing handleBellClick handler")
            if "handleAlertResolved" not in content:
                self.warnings.append("⚠️ Missing handleAlertResolved handler")
    
    def validate_authentication_flow(self):
        """Validate authentication integration"""
        print("\n🔐 Validating Authentication...")
        
        # Check backend auth
        handler_file = self.repo_path / "backend/app/api/api_v1/handlers/service_alert.py"
        if handler_file.exists():
            content = handler_file.read_text()
            if "get_current_user" not in content:
                self.issues.append("❌ Backend missing authentication dependency")
            else:
                self.successes.append("✅ Backend uses proper authentication")
        
        # Check frontend auth
        service_file = self.repo_path / "frontend/src/services/serviceAlertService.js"
        if service_file.exists():
            content = service_file.read_text()
            if "localStorage.getItem" in content and "token" in content:
                self.successes.append("✅ Frontend uses token authentication")
            else:
                self.issues.append("❌ Frontend missing token authentication")
    
    def validate_error_handling(self):
        """Validate error handling implementation"""
        print("\n⚠️ Validating Error Handling...")
        
        # Backend error handling
        handler_file = self.repo_path / "backend/app/api/api_v1/handlers/service_alert.py"
        if handler_file.exists():
            content = handler_file.read_text()
            if "HTTPException" in content:
                self.successes.append("✅ Backend uses HTTPException for errors")
            if "try:" in content and "except" in content:
                self.successes.append("✅ Backend has try/except error handling")
        
        # Frontend error handling
        components = [
            "frontend/src/components/customer/AlertBellAction.jsx",
            "frontend/src/components/customer/ServiceAlertDialog.jsx"
        ]
        
        for component_path in components:
            component_file = self.repo_path / component_path
            if component_file.exists():
                content = component_file.read_text()
                if "catch" in content or "error" in content:
                    self.successes.append(f"✅ {component_path.split('/')[-1]} has error handling")
                else:
                    self.warnings.append(f"⚠️ {component_path.split('/')[-1]} might lack error handling")
    
    def validate_performance_considerations(self):
        """Validate performance optimizations"""
        print("\n⚡ Validating Performance...")
        
        # Check for caching
        service_file = self.repo_path / "frontend/src/services/serviceAlertService.js"
        if service_file.exists():
            content = service_file.read_text()
            if "cache" in content.lower():
                self.successes.append("✅ Frontend service implements caching")
            else:
                self.warnings.append("⚠️ Consider implementing caching for better performance")
        
        # Check for proper indexes
        model_file = self.repo_path / "backend/app/models/service_alert_model.py"
        if model_file.exists():
            content = model_file.read_text()
            if "indexes" in content:
                self.successes.append("✅ Database model has indexes defined")
    
    def print_report(self):
        """Print validation report"""
        print("\n" + "=" * 60)
        print("📊 VALIDATION REPORT")
        print("=" * 60)
        
        # Successes
        if self.successes:
            print(f"\n✅ PASSED ({len(self.successes)} items):")
            for success in self.successes[:10]:  # Show first 10
                print(f"   {success}")
            if len(self.successes) > 10:
                print(f"   ... and {len(self.successes) - 10} more")
        
        # Warnings
        if self.warnings:
            print(f"\n⚠️ WARNINGS ({len(self.warnings)} items):")
            for warning in self.warnings:
                print(f"   {warning}")
        
        # Issues
        if self.issues:
            print(f"\n❌ ISSUES ({len(self.issues)} items):")
            for issue in self.issues:
                print(f"   {issue}")
        
        # Summary
        print("\n" + "-" * 60)
        total_checks = len(self.successes) + len(self.warnings) + len(self.issues)
        success_rate = (len(self.successes) / total_checks * 100) if total_checks > 0 else 0
        
        print(f"Total Checks: {total_checks}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if len(self.issues) == 0:
            print("\n🎉 Service Alert Feature Validation PASSED!")
        else:
            print("\n❗ Service Alert Feature has issues that need to be addressed.")
        
        return len(self.issues) == 0


def main():
    """Run validation"""
    # Determine repo path
    repo_path = "."
    if len(sys.argv) > 1:
        repo_path = sys.argv[1]
    
    validator = ServiceAlertValidator(repo_path)
    success = validator.validate_all()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()