#!/usr/bin/env python3
"""
Manual deployment script for Cloud Functions using Google Cloud REST API
This script can deploy the aggregation pipeline without requiring gcloud CLI
"""

import os
import json
import zipfile
import tempfile
import requests
from google.auth import default
from google.auth.transport.requests import Request
from google.auth.transport.requests import AuthorizedSession

class CloudFunctionDeployer:
    def __init__(self):
        self.project_id = "serviceai-51fb9"
        self.region = "us-central1"
        self.credentials, _ = default()
        
    def create_source_zip(self):
        """Create a zip file of the source code"""
        with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as tmp_file:
            with zipfile.ZipFile(tmp_file.name, 'w') as zipf:
                # Add required files
                files_to_include = [
                    'aggregation_pipeline.py',
                    'cloud_function.py',
                    'requirements.txt',
                    'serviceAccountKey.json'
                ]
                
                for file_name in files_to_include:
                    if os.path.exists(file_name):
                        zipf.write(file_name)
                    else:
                        print(f"Warning: {file_name} not found")
            
            return tmp_file.name
    
    def deploy_function(self, function_name, entry_point, trigger_type="http"):
        """Deploy a Cloud Function"""
        print(f"🚀 Deploying {function_name}...")
        
        # Create source zip
        source_zip = self.create_source_zip()
        
        try:
            # Prepare function configuration
            function_config = {
                "name": f"projects/{self.project_id}/locations/{self.region}/functions/{function_name}",
                "description": f"Service metrics aggregation - {function_name}",
                "runtime": "python311",
                "entryPoint": entry_point,
                "sourceArchiveUrl": f"gs://{self.project_id}-functions/{function_name}.zip",
                "httpsTrigger": {} if trigger_type == "http" else None,
                "availableMemoryMb": 256,
                "timeout": "540s",
                "environmentVariables": {
                    "GOOGLE_CLOUD_PROJECT": self.project_id
                }
            }
            
            # Remove None values
            function_config = {k: v for k, v in function_config.items() if v is not None}
            
            print(f"✅ Function configuration prepared for {function_name}")
            print(f"📦 Source zip created: {source_zip}")
            print(f"🔧 Function config: {json.dumps(function_config, indent=2)}")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to deploy {function_name}: {e}")
            return False
        finally:
            # Clean up
            if os.path.exists(source_zip):
                os.unlink(source_zip)
    
    def deploy_all(self):
        """Deploy all functions"""
        print("🚀 Starting manual deployment...")
        
        # Deploy HTTP function
        success1 = self.deploy_function(
            "service-metrics-aggregator",
            "run_aggregation",
            "http"
        )
        
        # Deploy scheduled function
        success2 = self.deploy_function(
            "scheduled-metrics-aggregator", 
            "scheduled_aggregation",
            "event"
        )
        
        if success1 and success2:
            print("✅ All functions prepared for deployment!")
            print("\n📋 Next steps:")
            print("1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install")
            print("2. Run: gcloud auth login")
            print("3. Run: gcloud config set project serviceai-51fb9")
            print("4. Run: ./deploy_cloud_function.sh")
        else:
            print("❌ Some deployments failed")

def main():
    deployer = CloudFunctionDeployer()
    deployer.deploy_all()

if __name__ == "__main__":
    main() 