import firebase_admin
from firebase_admin import credentials, firestore
import csv
import random
import time
from datetime import datetime, timezone
import os

# 50 random author names
AUTHOR_NAMES = [
    "Ava Patel", "Liam Smith", "Olivia Johnson", "Noah Williams", "Emma Brown",
    "Sophia Jones", "Jackson Miller", "Mia Davis", "Lucas Garcia", "Amelia Martinez",
    "Benjamin Rodriguez", "Charlotte Wilson", "Elijah Anderson", "Harper Thomas", "James Taylor",
    "Evelyn Moore", "Henry Lee", "Abigail Harris", "Alexander Clark", "Emily Lewis",
    "Sebastian Young", "Ella Walker", "Jack Hall", "Scarlett Allen", "Owen King",
    "Grace Wright", "Samuel Scott", "Chloe Green", "Matthew Adams", "Penelope Baker",
    "Carter Nelson", "Layla Hill", "Julian Rivera", "Aria Campbell", "Levi Mitchell",
    "Zoe Perez", "David Roberts", "Lily Turner", "Wyatt Phillips", "Nora Parker",
    "John Evans", "Hazel Edwards", "Dylan Collins", "Aurora Stewart", "Luke Sanchez",
    "Violet Morris", "Gabriel Rogers", "Hannah Reed", "Isaac Cook", "Ellie Morgan"
]

# 10 technician names
TECHNICIAN_NAMES = [
    "Devika Rane", "Zayan Khan", "Simran Kaur", "Fatima Sheikh", "Aarav Menon",
    "Kunal Verma", "Neha Patel", "Raghav Joshi", "Ishaan Rawat", "Priya Nambiar"
]

# Path to CSV
CSV_PATH = os.path.join("Data", "updated_tata_complaints_sequential.csv")

# Initialize Firebase Admin
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()

BATCH_SIZE = 5
SLEEP_SECONDS = 120  # 2 minutes

def random_id(prefix, length=8):
    return f"{prefix}_{random.randint(10000000, 99999999)}"

def main():
    with open(CSV_PATH, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        rows = list(reader)

    total = len(rows)
    print(f"Total rows in CSV: {total}")
    i = 0
    batch_num = 1
    while i < total:
        batch = rows[i:i+BATCH_SIZE]
        print(f"\nBatch {batch_num}: Writing rows {i+1} to {min(i+BATCH_SIZE, total)}...")
        for row in batch:
            now = datetime.now(timezone.utc)
            status = random.choice(["active", "closed"])
            author_name = random.choice(AUTHOR_NAMES)
            technician_name = random.choice(TECHNICIAN_NAMES)
            doc = {
                "acceptedAt": now if status in ["active", "closed"] else None,
                "authorId": random_id("test_user"),
                "authorName": author_name,
                "closedAt": now if status == "closed" else None,
                "createdAt": now,
                "requestDetails": row["Description"],
                "status": status,
                "technicianId": random_id("tech"),
                "technicianName": technician_name
            }
            db.collection("requests").add(doc)
            print(f"  Added request for {author_name} ({status}) with technician {technician_name}")
        i += BATCH_SIZE
        batch_num += 1
        if i < total:
            print(f"Sleeping for {SLEEP_SECONDS} seconds before next batch...")
            time.sleep(SLEEP_SECONDS)
    print("\nAll rows written to Firestore.")

if __name__ == "__main__":
    main() 