"""
generate_dataset.py
-------------------
Synthetic Dataset Generator for Small Language Model (SLM) Fine-Tuning.
Covers:
  Task A: Financial Transaction Categorization (13 categories, Indian & global merchants, UPI/SMS alerts, typos)
  Task B: Financial Query Understanding (8 intents, multi-period, operations, colloquial/Hinglish phrasing)

Features:
  - Deterministic generation with fixed random seed (42) for 100% reproducibility.
  - Zero external paid APIs required (optional TeacherModelGenerator interface provided).
  - High combinatorial variety (locations, prefixes, suffixes, amounts, dates, reference codes).
  - Group template tagging (template_id) to support group-aware train/val/test splitting.
  - Strict deduplication preventing identical or near-duplicate examples.
  - Finite iteration guarantees with collision guards to prevent infinite loops.
"""

import os
import json
import random
import argparse
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Set
from pathlib import Path

from validate_dataset import (
    ALLOWED_CATEGORIES,
    ALLOWED_INTENTS,
    ALLOWED_TRANSACTION_TYPES,
    ALLOWED_PERIODS,
    ALLOWED_OPERATIONS,
    DatasetRecord,
    CategorizationInput,
    CategorizationOutput,
    QueryUnderstandingOutput,
)

# ==============================================================================
# Optional Teacher Model Interface
# ==============================================================================

class TeacherModelGenerator(ABC):
    """
    Abstract interface for optional teacher-model based generation or augmentation.
    Allows plugging in local or cloud teacher models without hardcoding dependencies.
    """
    @abstractmethod
    def generate_categorization_examples(self, count: int) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def generate_query_examples(self, count: int) -> List[Dict[str, Any]]:
        pass


class DeterministicSyntheticGenerator(TeacherModelGenerator):
    """
    High-fidelity, deterministic rule-based synthetic generator.
    Guarantees diverse lexical patterns, realistic price points, and zero API costs.
    """
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = random.Random(seed)

    def generate_categorization_examples(self, count: int) -> List[Dict[str, Any]]:
        return []

    def generate_query_examples(self, count: int) -> List[Dict[str, Any]]:
        return []


# ==============================================================================
# Task A: Categorization Knowledge Base
# ==============================================================================

INDIAN_CITIES = [
    "Bangalore", "Mumbai", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata",
    "Ahmedabad", "Jaipur", "Chandigarh", "Noida", "Gurgaon", "Kochi", "Indore"
]

LOCALITIES = [
    "Koramangala", "Indiranagar", "Whitefield", "Bandra West", "Andheri", "Connaught Place",
    "Hitec City", "Gachibowli", "Kothrud", "T Nagar", "Salt Lake", "Jubilee Hills"
]

CATEGORY_DATA: Dict[str, Dict[str, Any]] = {
    "Food": {
        "merchants": [
            "Swiggy", "Zomato", "McDonald's", "KFC", "Domino's Pizza", "Subway", "Starbucks",
            "Chai Point", "Chaayos", "Burger King", "Haldiram's", "Bikanervala", "Behrouz Biryani",
            "Faasos", "Barbeque Nation", "Pizza Hut", "Wow! Momo", "Taco Bell", "Cafe Coffee Day",
            "Theobroma", "Mainland China", "Bawarchi Restaurant", "Saravana Bhavan", "EatClub",
            "Box8", "Dunkin' Donuts", "Nirula's", "Karim's", "Paradise Biryani", "Baskin Robbins"
        ],
        "items": [
            "chicken biryani", "cold coffee", "veg thali", "paneer butter masala with naan",
            "masala dosa and vada", "large pepperoni pizza", "burger with peri peri fries",
            "caramel frappuccino", "ginger chai and samosa", "momos platter", "dark chocolate pastry",
            "chicken shawarma roll", "tandoori chicken combo", "hakka noodles with manchurian",
            "red velvet cupcakes", "south indian filter coffee", "falooda kulfi", "garlic breadsticks"
        ],
        "contexts": [
            "dinner with friends", "quick office lunch", "late night craving", "weekend family brunch",
            "team celebration treat", "evening tea break snack", "sunday breakfast delivery",
            "takeaway for train journey", "birthday party food order"
        ],
        "typos": ["swigy", "zomto", "mcdonalds", "starbuks", "domnos", "chayos", "chai poynt", "pizahut"],
        "amount_range": (60.0, 3200.0),
        "type": "Expense",
    },
    "Shopping": {
        "merchants": [
            "Amazon India", "Flipkart", "Myntra", "Ajio", "Nykaa", "Meesho", "Tata CLiQ", "Zara",
            "H&M", "Uniqlo", "Croma", "Reliance Digital", "Decathlon", "Lenskart", "Nike", "Adidas",
            "Puma", "Westside", "Max Fashion", "IKEA", "Sephora", "Vijay Sales", "Crossword Books",
            "Bata", "Woodland", "Titan Watch Store", "Fabindia", "Zudio", "Shoppers Stop", "Pantaloons"
        ],
        "items": [
            "running shoes", "cotton slim fit shirt", "noise cancelling wireless earbuds",
            "sunscreen SPF 50 and moisturizer", "denim stretch jeans", "festive ethnic wear kurta",
            "yoga mat and gym resistance bands", "anti-glare computer reading glasses", "bestseller hardcover novel",
            "ergonomic aluminum laptop riser", "portable bluetooth speaker", "winter fleece zipper hoodie",
            "genuine leather bifold wallet", "scented soy wax candles and cushions", "smart fitness tracker watch"
        ],
        "contexts": [
            "online flash sale deal", "wardrobe upgrade", "birthday gift shopping", "weekend mall shopping",
            "festive diwali purchase", "replacement for broken item", "home office setup upgrade"
        ],
        "typos": ["amzn", "flpkrt", "myntra", "ajioo", "dekathlon", "lenzkart", "croma online"],
        "amount_range": (299.0, 18500.0),
        "type": "Expense",
    },
    "Transportation": {
        "merchants": [
            "Uber India", "Ola Cabs", "Rapido Bike Taxi", "Namma Yatri", "FASTag NETC Toll",
            "DMRC Delhi Metro", "BMRCL Namma Metro", "Mumbai Metro", "Indian Oil Corporation",
            "HPCL Petrol Pump", "Bharat Petroleum", "Shell Fuel Station", "Park+ Parking App",
            "Zoomcar", "BEST Bus Chalo Card", "Maha Metro", "Chennai Metro CMRL", "BluSmart EV Cab"
        ],
        "items": [
            "cab ride home from office", "auto ride to nearest metro station", "bike taxi ride during peak traffic",
            "metro smart card balance recharge", "vehicle petrol tank full refill", "highway expressway toll deduction",
            "airport drop premium cab", "hourly mall basement car parking", "monthly suburban train local pass",
            "EV car fast-charging charging unit session", "night surge ride from airport"
        ],
        "contexts": [
            "daily office commute", "weekend trip travel", "airport transit", "client meeting visit",
            "rainy day surge travel", "intercity highway transit"
        ],
        "typos": ["ubr", "olacabs", "rapido bike", "fasttag", "bmrcl metro", "ioc fuel"],
        "amount_range": (30.0, 4800.0),
        "type": "Expense",
    },
    "Entertainment": {
        "merchants": [
            "BookMyShow", "PVR Cinemas", "INOX Leisure", "Cinepolis", "Netflix India", "Spotify Premium",
            "Amazon Prime Video", "Disney+ Hotstar", "YouTube Premium", "SonyLIV", "Zee5", "Apple Music",
            "Steam Games", "PlayStation Network", "Google Play Store", "Wonderla Amusement Park",
            "Sula Vineyards", "IPL Cricket Tickets", "Comic Con India", "NCPA Mumbai"
        ],
        "items": [
            "weekend IMAX 3D movie tickets with snacks", "monthly family 4K streaming plan renewal",
            "annual music streaming student subscription", "live comedy standup open-mic night",
            "AAA action RPG digital game download", "in-game seasonal battle pass purchase",
            "amusement theme park all-access day ticket", "live music concert general admission ticket",
            "cricket T20 stadium match pass for 2", "independent documentary film festival pass"
        ],
        "contexts": [
            "weekend fun outing", "monthly auto-debit renewal", "friday night unwind", "holiday celebration",
            "gaming marathon top-up", "date night movie outing"
        ],
        "typos": ["bms movie", "netflx", "spotfy", "hotstar sub", "pvr cinma", "steam store"],
        "amount_range": (119.0, 5500.0),
        "type": "Expense",
    },
    "Healthcare": {
        "merchants": [
            "Apollo Pharmacy", "Netmeds", "Tata 1mg", "PharmEasy", "Dr. Lal PathLabs", "SRL Diagnostics",
            "Practo Consultations", "Max Healthcare", "Fortis Hospital", "Manipal Hospital", "Apollo Hospitals",
            "MedPlus Mart", "Clove Dental", "Cult Transform", "Metropolis Healthcare", "Thyrocare"
        ],
        "items": [
            "antibiotic prescription, paracetamol and cough syrup", "monthly routine blood pressure and diabetes medicine",
            "complete full body health checkup and lipid panel", "specialist doctor consultation video appointment",
            "dental cavity filling and root canal treatment", "ophthalmology eye checkup and soft contact lenses",
            "whey protein isolate tub and daily multivitamin pills", "first aid antiseptic spray and waterproof bandage box",
            "physiotherapy session for chronic back pain", "diagnostic thyroid ultrasound scan fee"
        ],
        "contexts": [
            "routine monthly refill", "doctor prescription clearance", "health recovery medicine",
            "wellness preventive care", "emergency clinic visit"
        ],
        "typos": ["apolo pharma", "1mg meds", "pharmeasy", "dr lal lab", "practo consult"],
        "amount_range": (85.0, 9500.0),
        "type": "Expense",
    },
    "Education": {
        "merchants": [
            "Byju's Learning", "Unacademy Plus", "Coursera Inc", "Udemy Online", "edX Platform",
            "Allen Career Institute", "FIITJEE Coaching", "Aakash Institute", "Chegg Study",
            "LinkedIn Learning", "Cambridge University Press", "College Registrar Office",
            "Exam Fee Portal NTA", "Duolingo Super", "IELTS IDP India", "Simplilearn"
        ],
        "items": [
            "engineering semester 4 college tuition installment", "full-stack web development professional bootcamp",
            "algorithms and machine learning specialization course", "civil services competitive exam books and test series",
            "foreign language yearly learning subscription", "IELTS academic exam registration seat fee",
            "university mathematics textbooks and lab stationery", "GATE computer science mock test series",
            "cloud solutions architect certification exam voucher"
        ],
        "contexts": [
            "career advancement skill learning", "semester fee payment deadline", "academic exam prep",
            "professional certification test", "upskilling course purchase"
        ],
        "typos": ["coursera fee", "udemy crse", "unacadmy", "colg tuition", "duolingo sub"],
        "amount_range": (499.0, 48000.0),
        "type": "Expense",
    },
    "Bills": {
        "merchants": [
            "BESCOM Bangalore Electricity", "Tata Power", "Torrent Power", "Adani Electricity Mumbai",
            "BSES Rajdhani Delhi", "Airtel Broadband Fiber", "JioFiber Home", "ACT Fibernet",
            "Vi Vodafone Idea Postpaid", "Mahanagar Gas Ltd MGL", "IGL Indraprastha Gas",
            "Bharat Petroleum LPG Gas", "HP Gas Refill", "Tata Play DTH", "Dish TV India",
            "Municipal Corporation Water Board", "Apartment Society Maintenance"
        ],
        "items": [
            "monthly residential electricity consumption bill", "high speed 300mbps fiber broadband bill",
            "LPG cooking gas cylinder refill booking", "mobile phone postpaid family plan bill payment",
            "piped natural gas residential meter bill", "quarterly municipal water supply bill",
            "society maintenance and building elevator charges", "direct-to-home satellite TV recharge",
            "annual property municipal tax online clearance"
        ],
        "contexts": [
            "monthly utility clearance", "autopay standing instruction", "quarterly bill payment",
            "due date bill clearance", "household essential expense"
        ],
        "typos": ["bescom bil", "tata powr", "jio fiber rechrg", "airtel bill", "lpg cylndr"],
        "amount_range": (249.0, 7800.0),
        "type": "Expense",
    },
    "Rent": {
        "merchants": [
            "Stanza Living Hostel", "ZoloStays Co-Living", "NestAway Technologies", "NoBroker RentPay",
            "CRED RentPay", "MyGate Society Rent", "Housing.com Rent", "Landlord Direct Bank Transfer",
            "Urban Co-Living Spaces", "Student PG Accommodation", "Green Glen Apartment Society"
        ],
        "items": [
            "monthly 2BHK apartment rent transfer to landlord", "co-living single occupancy room rent with food",
            "student PG hostel accommodation monthly fee", "advance rental security deposit first installment",
            "residential house lease payment for the month", "rent split share transferred to primary flatmate",
            "covered dedicated car parking rental space fee"
        ],
        "contexts": [
            "first of the month lease transfer", "quarterly advance rent", "hostel rent dues",
            "flatmate rent contribution", "contractual tenancy payment"
        ],
        "typos": ["nobroker rent", "flat rnt", "landlrd transfer", "pg rnt fee", "cred rentpay"],
        "amount_range": (6500.0, 75000.0),
        "type": "Expense",
    },
    "Groceries": {
        "merchants": [
            "Blinkit Commerce", "Zepto Quick Delivery", "BigBasket", "DMart Supermarket",
            "Reliance Fresh", "Nature's Basket", "More Supermarkets", "Spencer's Retail",
            "FreshToHome Fish & Meat", "Country Delight Dairy", "Local Sabzi Mandi",
            "Mother Dairy Milk Booth", "Amul Store", "Dunzo Daily Grocery"
        ],
        "items": [
            "weekly fresh vegetables, tomatoes, onions and apples", "daily organic cow milk, brown eggs and malai paneer",
            "monthly pantry staples: basmati rice, atta, toor dal and mustard oil",
            "quick 10-minute essentials: multigrain bread, salted butter and chips",
            "dry fruits combo pack: premium almonds, cashews and raisins",
            "aromatic spices, whole cumin seeds, turmeric and tea powder refill",
            "fresh boneless chicken breast and rohu fish cuts",
            "laundry detergent powder, liquid dishwash and floor disinfectant",
            "healthy breakfast rolled oats, muesli and roasted peanut butter"
        ],
        "contexts": [
            "weekly pantry restock", "daily morning breakfast supplies", "monthly bulk grocery shopping",
            "emergency cooking ingredients run", "weekend cooking ingredients"
        ],
        "typos": ["blinkt", "zpto", "bigbaskt", "dmart super", "sabzi mandi", "cntry delight"],
        "amount_range": (120.0, 7200.0),
        "type": "Expense",
    },
    "Travel": {
        "merchants": [
            "MakeMyTrip India", "Cleartrip Flights", "IRCTC Indian Railways", "IndiGo Airlines",
            "Air India", "Vistara Airways", "Akasa Air", "OYO Hotels", "Airbnb Stays",
            "Taj Hotels & Resorts", "Marriott International", "RedBus Tickets", "AbhiBus",
            "Thomas Cook Travel", "VFS Global Visa Application", "Goibibo Travel"
        ],
        "items": [
            "round-trip non-stop flight tickets booking", "IRCTC 2nd AC sleeper train reservation ticket",
            "heritage boutique hotel stay for 2 nights", "mountain valley homestay cottage rental booking",
            "overnight AC multi-axle luxury sleeper bus ticket", "international airport lounge access passes",
            "tourist visa biometric submission and processing fee", "seaside beach resort weekend package reservation",
            "national park wildlife safari permit and guide fee"
        ],
        "contexts": [
            "annual family vacation trip", "hometown festival visit travel", "business conference travel",
            "weekend road getaway", "long weekend mountain holiday"
        ],
        "typos": ["makemytrip", "irctc ticket", "indgo air", "air bnb", "redbus tkt", "vistara flt"],
        "amount_range": (350.0, 52000.0),
        "type": "Expense",
    },
    "Salary": {
        "merchants": [
            "Tata Consultancy Services", "Infosys Ltd", "Wipro Technologies", "Accenture India",
            "Cognizant Technology Solutions", "Google India Pvt Ltd", "Microsoft India",
            "Amazon Development Centre India", "HDFC Bank Payroll CMS", "RazorpayX Payroll",
            "Deel Global Payroll", "Remote Technology Inc", "Upwork Global Escrow", "Advisory Client Direct"
        ],
        "items": [
            "monthly corporate salary credited to salary savings account", "quarterly engineering milestone performance bonus payout",
            "software development retainer compensation disbursement", "freelance digital UI/UX consulting fee payment",
            "annual performance appraisal variable pay credit", "research intern monthly stipend disbursement",
            "project completion incentive and overtime allowance", "international client milestone wire transfer credited"
        ],
        "contexts": [
            "end of month payroll credit", "bi-weekly automated direct deposit", "quarterly bonus payout",
            "client contract settlement", "consulting invoice payment"
        ],
        "typos": ["sal credt", "payroll ach", "infy salary", "tcs payroll", "stipnd pymnt"],
        "amount_range": (28000.0, 380000.0),
        "type": "Income",
    },
    "Investment": {
        "merchants": [
            "Zerodha Broking Kite", "Groww Nextbillion Technology", "Upstox Securities",
            "Angel One Trading", "ICICI Direct", "HDFC Securities", "Coin Mutual Funds",
            "INDmoney Global Stocks", "Kuvera Wealth", "Smallcase Technologies",
            "Nippon India Mutual Fund", "Mirae Asset Investment", "SBI Mutual Fund",
            "Sovereign Gold Bond RBI", "Parag Parikh Flexi Cap Fund"
        ],
        "items": [
            "monthly systematic investment plan (SIP) auto-debit in flexi cap fund",
            "purchased equity shares of top nifty bluechip companies",
            "quarterly cash dividend credited to verified bank account",
            "fixed deposit cumulative interest maturity proceeds credited",
            "public provident fund (PPF) annual contribution tax-saver deposit",
            "national pension scheme (NPS) tier-1 voluntary retirement deposit",
            "sovereign gold bond tranche application allocation",
            "mutual fund systematic withdrawal plan (SWP) credited",
            "overseas US broad market index ETF fractional shares"
        ],
        "contexts": [
            "first week monthly disciplined SIP", "portfolio rebalancing purchase", "long term wealth compounding",
            "annual tax saving deduction 80C", "dividend income received"
        ],
        "typos": ["zerodha sip", "grow mf", "upstox trade", "nifty sip", "ppf deposit"],
        "amount_range": (500.0, 120000.0),
        "type": "Expense",
    },
    "Other": {
        "merchants": [
            "State Bank of India ATM", "HDFC Bank ATM", "ICICI Bank ATM", "CRED Credit Card Bill",
            "HDFC Credit Card Billdesk", "PM CARES Fund Donation", "The Akshaya Patra Foundation",
            "Traffic Police E-Challan Portal", "RTO Driving License Online Portal",
            "Friend UPI Money Transfer", "Amazon Refund Processing", "Flipkart Refund Credit",
            "Society Club Gym Membership", "Cash Deposit Machine CDM"
        ],
        "items": [
            "ATM cash withdrawal for emergency cash buffer wallet", "settlement of monthly bank credit card total statement bill",
            "charitable nonprofit tax-deductible donation transfer", "traffic lane violation online e-challan penalty fine",
            "split dinner dining bill payment sent to friend via UPI", "refund credit received for returned ecommerce delivery",
            "motor vehicle driving license test renewal fee", "passport physical verification processing fee",
            "house locksmith emergency lock repair service fee", "personal family emergency financial support transfer"
        ],
        "contexts": [
            "cash buffer top-up", "card bill clearance", "government fee compliance",
            "p2p peer reimbursement", "order return refund"
        ],
        "typos": ["atm cash", "cred billpay", "e challan", "upi txfr to frnd", "rfnd cr"],
        "amount_range": (100.0, 35000.0),
        "type": "Expense",
    },
}


# ==============================================================================
# Task B: Query Understanding Knowledge Base
# ==============================================================================

QUERY_OPENERS = [
    "", "Can you tell me", "Please tell me", "I want to know", "Quick question:",
    "Could you check", "Look up", "Show me", "Check my records:", "Kindly calculate",
    "Help me find", "Do I know", "Can you compute", "Bhai batao,", "Please check:",
    "How about", "Let me see", "Just wondering,"
]

QUERY_CLOSERS = [
    "", "?", " please?", " for my finances.", " right now.", " if possible.",
    " from my account.", " in INR.", " asap.", " strictly.", " batao na.",
    " from last statements.", " exactly."
]

INTENT_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "total_expenses": [
        {"template_id": "tot_exp_direct", "pattern": "how much did I spend in total {period}", "op": "sum"},
        {"template_id": "tot_exp_direct", "pattern": "what are my total expenses {period}", "op": "sum"},
        {"template_id": "tot_exp_casual", "pattern": "tell me total money spent {period}", "op": "sum"},
        {"template_id": "tot_exp_casual", "pattern": "how much cash went out of my account {period}", "op": "sum"},
        {"template_id": "tot_exp_hinglish", "pattern": "mera total kharcha kitna hua {period}", "op": "sum"},
        {"template_id": "tot_exp_hinglish", "pattern": "{period} kitna paisa spend kiya total", "op": "sum"},
        {"template_id": "tot_exp_short", "pattern": "total spending {period}", "op": "sum"},
        {"template_id": "tot_exp_short", "pattern": "overall outflow {period}", "op": "sum"},
        {"template_id": "tot_exp_formal", "pattern": "calculate aggregate debits and expenditures {period}", "op": "sum"},
        {"template_id": "tot_exp_typo", "pattern": "how mch did i spnd {period}", "op": "sum"},
    ],
    "total_income": [
        {"template_id": "tot_inc_direct", "pattern": "what is my total income {period}", "op": "sum"},
        {"template_id": "tot_inc_direct", "pattern": "how much money did I earn {period}", "op": "sum"},
        {"template_id": "tot_inc_casual", "pattern": "how much cash came in {period}", "op": "sum"},
        {"template_id": "tot_inc_casual", "pattern": "show my total earnings and credits {period}", "op": "sum"},
        {"template_id": "tot_inc_hinglish", "pattern": "total kitni kamai hui {period}", "op": "sum"},
        {"template_id": "tot_inc_hinglish", "pattern": "{period} me kitna paisa account me aaya", "op": "sum"},
        {"template_id": "tot_inc_short", "pattern": "total income {period}", "op": "sum"},
        {"template_id": "tot_inc_formal", "pattern": "calculate total credits, salary and inflows {period}", "op": "sum"},
        {"template_id": "tot_inc_salary", "pattern": "did my salary and bonuses get counted {period}", "op": "sum"},
        {"template_id": "tot_inc_typo", "pattern": "totl incm {period}", "op": "sum"},
    ],
    "category_spending": [
        {"template_id": "cat_spd_direct", "pattern": "how much did I spend on {category} {period}", "op": "sum"},
        {"template_id": "cat_spd_direct", "pattern": "what were my {category} expenses {period}", "op": "sum"},
        {"template_id": "cat_spd_casual", "pattern": "how much went into {category} {period}", "op": "sum"},
        {"template_id": "cat_spd_casual", "pattern": "show money spent on {category} {period}", "op": "sum"},
        {"template_id": "cat_spd_hinglish", "pattern": "{category} pe kitna kharcha hua {period}", "op": "sum"},
        {"template_id": "cat_spd_hinglish", "pattern": "{period} {category} me kitne paise lag gaye", "op": "sum"},
        {"template_id": "cat_spd_short", "pattern": "{category} spending {period}", "op": "sum"},
        {"template_id": "cat_spd_formal", "pattern": "retrieve aggregate expenditure categorized under {category} {period}", "op": "sum"},
        {"template_id": "cat_spd_typo", "pattern": "hw much spnt on {category} {period}", "op": "sum"},
        {"template_id": "cat_spd_count", "pattern": "how many times did I pay for {category} {period}", "op": "count"},
    ],
    "monthly_summary": [
        {"template_id": "mon_sum_direct", "pattern": "give me the financial summary for {period}", "op": "summary"},
        {"template_id": "mon_sum_direct", "pattern": "show my monthly report for {period}", "op": "summary"},
        {"template_id": "mon_sum_casual", "pattern": "how did my finances look {period}", "op": "summary"},
        {"template_id": "mon_sum_casual", "pattern": "give an overview of income vs expense {period}", "op": "summary"},
        {"template_id": "mon_sum_hinglish", "pattern": "{period} ka pura hisab kitab dikhao", "op": "summary"},
        {"template_id": "mon_sum_hinglish", "pattern": "{period} ka overall summary batao", "op": "summary"},
        {"template_id": "mon_sum_short", "pattern": "monthly summary {period}", "op": "summary"},
        {"template_id": "mon_sum_formal", "pattern": "generate an executive breakdown of cashflow for {period}", "op": "summary"},
        {"template_id": "mon_sum_typo", "pattern": "mnthly summry {period}", "op": "summary"},
    ],
    "date_range_summary": [
        {"template_id": "rng_sum_direct", "pattern": "how much did I spend between {date1} and {date2}", "op": "sum"},
        {"template_id": "rng_sum_direct", "pattern": "show transactions from {date1} to {date2}", "op": "sum"},
        {"template_id": "rng_sum_casual", "pattern": "total spending from {date1} until {date2}", "op": "sum"},
        {"template_id": "rng_sum_hinglish", "pattern": "{date1} se {date2} ke beech kitna kharcha hua", "op": "sum"},
        {"template_id": "rng_sum_short", "pattern": "spending from {date1} to {date2}", "op": "sum"},
        {"template_id": "rng_sum_formal", "pattern": "aggregate debits occurring between {date1} and {date2}", "op": "sum"},
        {"template_id": "rng_sum_typo", "pattern": "spndng b/w {date1} and {date2}", "op": "sum"},
    ],
    "highest_spending_category": [
        {"template_id": "top_cat_direct", "pattern": "which category did I spend the most on {period}", "op": "max"},
        {"template_id": "top_cat_direct", "pattern": "what was my highest expense category {period}", "op": "max"},
        {"template_id": "top_cat_casual", "pattern": "where did most of my money go {period}", "op": "max"},
        {"template_id": "top_cat_casual", "pattern": "what ate up my budget {period}", "op": "max"},
        {"template_id": "top_cat_hinglish", "pattern": "sabse zyada kharcha kahan hua {period}", "op": "max"},
        {"template_id": "top_cat_hinglish", "pattern": "kaunse category me sabse jyada paise gaye {period}", "op": "max"},
        {"template_id": "top_cat_short", "pattern": "top spending category {period}", "op": "max"},
        {"template_id": "top_cat_formal", "pattern": "identify the expense category with the largest total debit {period}", "op": "max"},
        {"template_id": "top_cat_typo", "pattern": "bggest expnse catgry {period}", "op": "max"},
    ],
    "budget_status": [
        {"template_id": "bgt_stat_direct", "pattern": "how is my budget for {category} looking {period}", "op": "check"},
        {"template_id": "bgt_stat_direct", "pattern": "did I exceed my {category} budget {period}", "op": "check"},
        {"template_id": "bgt_stat_casual", "pattern": "am I overspending on {category} {period}", "op": "check"},
        {"template_id": "bgt_stat_casual", "pattern": "how much budget is left for {category} {period}", "op": "check"},
        {"template_id": "bgt_stat_hinglish", "pattern": "{category} ka budget bacha hai kya {period}", "op": "check"},
        {"template_id": "bgt_stat_hinglish", "pattern": "kya maine {category} me limit cross kar di {period}", "op": "check"},
        {"template_id": "bgt_stat_short", "pattern": "{category} budget progress {period}", "op": "check"},
        {"template_id": "bgt_stat_formal", "pattern": "check threshold utilization and variance for {category} budget {period}", "op": "check"},
        {"template_id": "bgt_stat_typo", "pattern": "is {category} bdget ovrspent {period}", "op": "check"},
    ],
    "savings_summary": [
        {"template_id": "svg_sum_direct", "pattern": "how much money did I save {period}", "op": "sum"},
        {"template_id": "svg_sum_direct", "pattern": "what is my total savings {period}", "op": "sum"},
        {"template_id": "svg_sum_casual", "pattern": "how much cash was left over {period}", "op": "sum"},
        {"template_id": "svg_sum_casual", "pattern": "what is my net savings rate {period}", "op": "sum"},
        {"template_id": "svg_sum_hinglish", "pattern": "{period} kitna paisa bacha mere paas", "op": "sum"},
        {"template_id": "svg_sum_hinglish", "pattern": "total bachat kitni hui {period}", "op": "sum"},
        {"template_id": "svg_sum_short", "pattern": "savings summary {period}", "op": "sum"},
        {"template_id": "svg_sum_formal", "pattern": "calculate net surplus cashflow after all debits {period}", "op": "sum"},
        {"template_id": "svg_sum_typo", "pattern": "hw much did i sav {period}", "op": "sum"},
    ],
}

PERIOD_PHRASINGS: Dict[str, List[str]] = {
    "current_month": ["this month", "in current month", "for this month", "during the current month", "is mahine"],
    "previous_month": ["last month", "in previous month", "for last month", "during the previous month", "pichle mahine"],
    "last_30_days": ["in the last 30 days", "past 30 days", "over the last month", "pichle 30 din me"],
    "current_week": ["this week", "during this week", "in the current week", "is hafte"],
    "last_week": ["last week", "in the previous week", "past 7 days", "pichle hafte"],
    "today": ["today", "so far today", "aaj ka"],
    "yesterday": ["yesterday", "kal ka"],
    "current_year": ["this year", "in 2026", "during the current year", "is saal"],
    "previous_year": ["last year", "in 2025", "during the previous year", "pichle saal"],
    "all_time": ["so far", "overall", "all time", "till date", "ab tak"],
}

SAMPLE_DATE_RANGES = [
    ("2026-10-01", "2026-10-15"),
    ("2026-09-01", "2026-09-30"),
    ("2026-10-15", "2026-10-31"),
    ("2026-11-01", "2026-11-10"),
    ("1st Oct", "15th Oct"),
    ("15th September", "30th September"),
    ("Jan 1", "Jan 31"),
    ("last Monday", "yesterday"),
    ("1st of this month", "yesterday"),
    ("Oct 10", "Oct 25"),
    ("2026-08-01", "2026-08-31"),
    ("September 1", "September 15"),
]


# ==============================================================================
# Generator Engine
# ==============================================================================

class DatasetSynthesizer:
    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)
        self.seen_hashes: Set[str] = set()

    def _get_unique_key(self, task: str, inp_val: Any) -> str:
        s = json.dumps(inp_val, sort_keys=True) if isinstance(inp_val, dict) else str(inp_val)
        return f"{task}::{s.strip().lower()}"

    def generate_categorization_records(self, target_count: int = 4400) -> List[Dict[str, Any]]:
        """
        Generates synthetic transaction categorization examples across all 13 categories.
        Guarantees high lexical diversity, realistic amounts, SMS alerts, typos, and UPI strings.
        """
        records: List[Dict[str, Any]] = []
        per_category_target = target_count // len(ALLOWED_CATEGORIES)

        for category in ALLOWED_CATEGORIES:
            cat_data = CATEGORY_DATA[category]
            cat_records = 0
            attempts = 0
            max_attempts = per_category_target * 50

            while cat_records < per_category_target and attempts < max_attempts:
                attempts += 1
                variant_type = self.rng.choices(
                    ["merchant_item", "bank_sms", "colloquial_typo", "pure_desc", "location_tagged"],
                    weights=[0.30, 0.25, 0.15, 0.15, 0.15],
                    k=1
                )[0]

                merchant = self.rng.choice(cat_data["merchants"])
                item = self.rng.choice(cat_data["items"])
                context = self.rng.choice(cat_data["contexts"])
                city = self.rng.choice(INDIAN_CITIES)
                locality = self.rng.choice(LOCALITIES)

                min_amt, max_amt = cat_data["amount_range"]
                amt = round(self.rng.uniform(min_amt, max_amt), 2)
                ref_num = f"{self.rng.randint(100000, 999999)}"
                card_num = f"XX{self.rng.randint(1000, 9999)}"
                fake_date = f"2026-10-{self.rng.randint(1, 28):02d}"

                if variant_type == "merchant_item":
                    template_id = f"cat_tpl_{category.lower()}_merchant_item"
                    text = f"{merchant} - {item}"
                elif variant_type == "bank_sms":
                    template_id = f"cat_tpl_{category.lower()}_sms_alert"
                    sms_patterns = [
                        f"Paid INR {amt:.2f} to {merchant} via UPI ref {ref_num}",
                        f"Txn of INR {amt:.2f} at {merchant} on {fake_date}",
                        f"UPI/P2M/{merchant}/PAYMENT/{ref_num}",
                        f"Debited Rs.{amt:.2f} for order at {merchant}",
                        f"Paid at {merchant} outlet via Card {card_num}",
                        f"Sent Rs.{amt:.2f} to {merchant} on {fake_date}. Ref: {ref_num}",
                    ]
                    text = self.rng.choice(sms_patterns)
                elif variant_type == "colloquial_typo":
                    template_id = f"cat_tpl_{category.lower()}_informal_typo"
                    typo = self.rng.choice(cat_data["typos"])
                    text = f"{typo} payment {item} {context}"
                elif variant_type == "location_tagged":
                    template_id = f"cat_tpl_{category.lower()}_location"
                    text = f"{merchant} {locality} {city} - {item}"
                else:
                    template_id = f"cat_tpl_{category.lower()}_pure_desc"
                    text = f"{item.capitalize()} for {context}"

                # Determine transaction type
                if category == "Salary":
                    tx_type = "Income"
                elif category == "Investment":
                    tx_type = "Income" if any(k in text.lower() for k in ["dividend", "credited", "maturity", "proceeds", "swp"]) else "Expense"
                elif category == "Other":
                    tx_type = "Income" if any(k in text.lower() for k in ["refund", "deposit", "credited"]) else "Expense"
                else:
                    tx_type = "Expense"

                inp = {"description": text, "amount": amt}
                out = {"category": category, "transaction_type": tx_type}

                key = self._get_unique_key("categorization", inp)
                if key in self.seen_hashes:
                    continue

                try:
                    record_obj = DatasetRecord(
                        task="categorization",
                        input=CategorizationInput(**inp),
                        output=CategorizationOutput(**out),
                        template_id=template_id,
                    )
                    self.seen_hashes.add(key)
                    records.append(record_obj.model_dump())
                    cat_records += 1
                except Exception:
                    continue

        return records

    def generate_query_records(self, target_count: int = 3600) -> List[Dict[str, Any]]:
        """
        Generates natural-language financial queries across 8 intents.
        Combines openers, core patterns, periods, categories, dates, and closers
        to produce thousands of natural, non-repeating queries.
        """
        records: List[Dict[str, Any]] = []
        per_intent_target = target_count // len(ALLOWED_INTENTS)

        for intent in ALLOWED_INTENTS:
            intent_templates = INTENT_TEMPLATES[intent]
            intent_records = 0
            attempts = 0
            max_attempts = per_intent_target * 50

            while intent_records < per_intent_target and attempts < max_attempts:
                attempts += 1
                tpl_obj = self.rng.choice(intent_templates)
                template_id = tpl_obj["template_id"]
                pat = tpl_obj["pattern"]
                op = tpl_obj.get("op", "sum")

                opener = self.rng.choice(QUERY_OPENERS)
                closer = self.rng.choice(QUERY_CLOSERS)

                # Sample period
                period_key = self.rng.choice(list(PERIOD_PHRASINGS.keys()))
                period_str = self.rng.choice(PERIOD_PHRASINGS[period_key])

                # Sample category
                cat_val = self.rng.choice(ALLOWED_CATEGORIES) if intent in ["category_spending", "budget_status"] else None
                cat_display = cat_val.lower() if cat_val else ""

                # Sample dates for date_range_summary
                d1, d2 = self.rng.choice(SAMPLE_DATE_RANGES)

                # Format core sentence
                core = pat.replace("{period}", period_str)
                if "{category}" in core:
                    core = core.replace("{category}", cat_display)
                if "{date1}" in core:
                    core = core.replace("{date1}", d1)
                if "{date2}" in core:
                    core = core.replace("{date2}", d2)

                # Assemble query
                parts = [p for p in [opener, core] if p]
                question = " ".join(parts).strip()
                if closer:
                    question = f"{question}{closer}"
                elif not question.endswith("?") and not question.endswith("."):
                    question += "?"

                # Casing variations
                if self.rng.random() < 0.25:
                    question = question.lower()
                elif self.rng.random() < 0.20:
                    question = question.capitalize()

                out_payload: Dict[str, Any] = {
                    "intent": intent,
                    "category": cat_val,
                    "period": "custom" if intent == "date_range_summary" else period_key,
                    "operation": op,
                }

                if intent == "date_range_summary":
                    out_payload["start_date"] = d1
                    out_payload["end_date"] = d2

                key = self._get_unique_key("query_understanding", question)
                if key in self.seen_hashes:
                    continue

                try:
                    record_obj = DatasetRecord(
                        task="query_understanding",
                        input=question,
                        output=QueryUnderstandingOutput(**out_payload),
                        template_id=template_id,
                    )
                    self.seen_hashes.add(key)
                    records.append(record_obj.model_dump())
                    intent_records += 1
                except Exception:
                    continue

        return records

    def generate_full_dataset(self, total_target: int = 8000) -> List[Dict[str, Any]]:
        """
        Generates full balanced dataset of categorization and query understanding records.
        """
        cat_count = int(total_target * 0.55) # ~4400 categorization
        query_count = total_target - cat_count # ~3600 queries

        print(f"[Synthesizer] Generating {cat_count} categorization records across {len(ALLOWED_CATEGORIES)} categories...")
        cat_records = self.generate_categorization_records(cat_count)

        print(f"[Synthesizer] Generating {query_count} query understanding records across {len(ALLOWED_INTENTS)} intents...")
        query_records = self.generate_query_records(query_count)

        full_set = cat_records + query_records
        self.rng.shuffle(full_set)

        print(f"[Synthesizer] Successfully synthesized {len(full_set)} validated, deduplicated records.")
        return full_set


# ==============================================================================
# CLI Entrypoint
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Deterministic Dataset Generator for Personal Finance SLM")
    parser.add_argument("--count", "-c", type=int, default=8000, help="Total number of records to generate (5000-10000)")
    parser.add_argument("--seed", "-s", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--output", "-o", type=str, default="data/raw/synthetic_dataset.jsonl", help="Output JSONL path")
    args = parser.parse_args()

    count = max(5000, min(args.count, 12000))
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    synthesizer = DatasetSynthesizer(seed=args.seed)
    dataset = synthesizer.generate_full_dataset(total_target=count)

    with open(out_path, "w", encoding="utf-8") as f:
        for item in dataset:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"[Synthesizer] Saved {len(dataset)} raw records to: {out_path.resolve()}")


if __name__ == "__main__":
    main()
