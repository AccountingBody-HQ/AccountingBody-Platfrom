import xml.etree.ElementTree as ET
import requests, json, re, os, time, uuid
from bs4 import BeautifulSoup, NavigableString, Tag

XML_FILE = "/workspaces/AccountingBody-Platfrom/accountingbodycom.WordPress.2026-04-03.xml"
PROJECT_ID = "4rllejq1"
DATASET = "production"
TOKEN = os.environ["SANITY_API_TOKEN"]
LOG_FILE = "/workspaces/AccountingBody-Platfrom/scripts/migration_log.json"
API_URL = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/mutate/{DATASET}"
WP_NS = "http://wordpress.org/export/1.2/"
CONTENT_NS = "http://purl.org/rss/1.0/modules/content/"

if os.path.exists(LOG_FILE):
    with open(LOG_FILE) as f: log = json.load(f)
else:
    log = {"done":[],"failed":[],"skipped":[]}

def save_log():
    with open(LOG_FILE,"w") as f: json.dump(log,f,indent=2)

def uid(): return uuid.uuid4().hex[:12]

def clean_soup(soup):
    for tag in soup.find_all(["script","math","nav"]): tag.decompose()
    for bq in soup.find_all("blockquote"):
        if bq.get_text().strip() in ("Key Takeaways","Full Tutorial"): bq.decompose()
    for div in soup.find_all("div", class_=lambda c: c and "wp-block-group" in c):
        if "Further Reading" in div.get_text(): div.decompose()
    for p in soup.find_all("p"):
        if "palette-color-6" in " ".join(p.get("class",[])) and "Further Reading" in p.get_text(): p.decompose()
    for ul in soup.find_all("ul", class_=lambda c: c and "yoast-seo-related-links" in c): ul.decompose()
    return soup
def parse_inline(tag):
    children, mark_defs = [], []
    for node in tag.children:
        if isinstance(node, NavigableString):
            t = str(node).replace(chr(10)," ")
            if t.strip(): children.append({"_type":"span","_key":uid(),"text":t,"marks":[]})
        elif isinstance(node, Tag):
            if node.name == "br":
                children.append({"_type":"span","_key":uid(),"text":" ","marks":[]})
                continue
            if node.name in ("ul","ol"): continue
            t = node.get_text().replace(chr(10)," ")
            if not t.strip(): continue
            marks = []
            if node.name in ("strong","b"): marks = ["strong"]
            elif node.name in ("em","i"): marks = ["em"]
            elif node.name == "code": marks = ["code"]
            elif node.name == "a":
                href = node.get("href","")
                if href:
                    k = uid()
                    mark_defs.append({"_type":"link","_key":k,"href":href})
                    marks = [k]
            children.append({"_type":"span","_key":uid(),"text":t,"marks":marks})
    return children, mark_defs

def process_list(el, list_type, level, blocks):
    for li in el.find_all("li", recursive=False):
        li_children, li_mark_defs = [], []
        for node in li.children:
            if isinstance(node, NavigableString):
                t = str(node).replace(chr(10)," ").strip()
                if t: li_children.append({"_type":"span","_key":uid(),"text":t,"marks":[]})
            elif isinstance(node, Tag):
                if node.name in ("ul","ol"): continue
                t = node.get_text().strip()
                if not t: continue
                if node.name in ("strong","b"): li_children.append({"_type":"span","_key":uid(),"text":t,"marks":["strong"]})
                elif node.name in ("em","i"): li_children.append({"_type":"span","_key":uid(),"text":t,"marks":["em"]})
                elif node.name == "a":
                    href = node.get("href","")
                    if href:
                        k = uid()
                        li_mark_defs.append({"_type":"link","_key":k,"href":href})
                        li_children.append({"_type":"span","_key":uid(),"text":t,"marks":[k]})
                else:
                    li_children.append({"_type":"span","_key":uid(),"text":t,"marks":[]})
        if li_children:
            blocks.append({"_type":"block","_key":uid(),"style":"normal","listItem":list_type,"level":level,"markDefs":li_mark_defs,"children":li_children})
        for child in li.find_all(["ul","ol"], recursive=False):
            process_list(child, "bullet" if child.name=="ul" else "number", level+1, blocks)
def convert_table(table):
    headers, rows = [], []
    thead = table.find("thead")
    if thead:
        header_cells = thead.find_all(["th","td"])
        headers = [cell.get_text().strip() for cell in header_cells]
    tbody = table.find("tbody")
    if tbody:
        for tr in tbody.find_all("tr"):
            cells = [td.get_text().strip() for td in tr.find_all("td")]
            if cells: rows.append({"_type":"tableRow","_key":uid(),"cells":cells})
    if not headers and not rows:
        all_rows = table.find_all("tr")
        for i, tr in enumerate(all_rows):
            ths = tr.find_all("th")
            tds = tr.find_all("td")
            if ths and i == 0:
                headers = [th.get_text().strip() for th in ths]
            elif tds:
                cells = [td.get_text().strip() for td in tds]
                if cells: rows.append({"_type":"tableRow","_key":uid(),"cells":cells})
    return {"_type":"tableBlock","_key":uid(),"headers":headers,"rows":rows} if headers or rows else None

def process_element(el, blocks):
    if el.name in ("h1","h2","h3","h4","h5","h6"):
        t = el.get_text().strip()
        if t: blocks.append({"_type":"block","_key":uid(),"style":el.name,"markDefs":[],"children":[{"_type":"span","_key":uid(),"text":t,"marks":[]}]})
    elif el.name == "p":
        children, mark_defs = parse_inline(el)
        if children: blocks.append({"_type":"block","_key":uid(),"style":"normal","markDefs":mark_defs,"children":children})
    elif el.name in ("ul","ol"):
        process_list(el, "bullet" if el.name=="ul" else "number", 1, blocks)
    elif el.name == "blockquote":
        t = el.get_text().strip()
        if t: blocks.append({"_type":"block","_key":uid(),"style":"blockquote","markDefs":[],"children":[{"_type":"span","_key":uid(),"text":t,"marks":[]}]})
    elif el.name == "table":
        tb = convert_table(el)
        if tb: blocks.append(tb)
    elif el.name == "figure":
        inner_table = el.find("table")
        if inner_table:
            tb = convert_table(inner_table)
            if tb: blocks.append(tb)
        else:
            cap = el.find("figcaption")
            if cap:
                t = cap.get_text().strip()
                if t: blocks.append({"_type":"block","_key":uid(),"style":"normal","markDefs":[],"children":[{"_type":"span","_key":uid(),"text":t,"marks":["em"]}]})
    elif el.name == "pre":
        t = el.get_text().strip()
        if t: blocks.append({"_type":"block","_key":uid(),"style":"normal","markDefs":[],"children":[{"_type":"span","_key":uid(),"text":t,"marks":["code"]}]})
    elif el.name == "div":
        for child in el.find_all(["h1","h2","h3","h4","h5","h6","p","ul","ol","blockquote","table","figure","pre","div"], recursive=False):
            process_element(child, blocks)
def html_to_blocks(html):
    if not html: return []
    html = re.sub(r"<!--.*?-->","",html,flags=re.DOTALL)
    html = re.sub(r"\[/?[a-z_]+[^\]]*\]","",html)
    soup = BeautifulSoup(html,"html.parser")
    soup = clean_soup(soup)
    blocks = []
    for el in soup.find_all(["h1","h2","h3","h4","h5","h6","p","ul","ol","blockquote","table","figure","pre","div"], recursive=False):
        process_element(el, blocks)
    if not blocks:
        t = soup.get_text().strip()
        if t: blocks.append({"_type":"block","_key":uid(),"style":"normal","markDefs":[],"children":[{"_type":"span","_key":uid(),"text":t,"marks":[]}]})
    return blocks

def make_slug(text):
    slug = re.sub(r"[^a-z0-9-]","-",text.lower())
    return re.sub(r"-+","-",slug).strip("-")[:180]

def send_to_sanity(doc):
    resp = requests.post(API_URL, headers={"Authorization":f"Bearer {TOKEN}","Content-Type":"application/json"}, json={"mutations":[{"createOrReplace":doc}]}, timeout=30)
    return resp.status_code, resp.json()

print("Parsing XML...")
tree = ET.parse(XML_FILE)
root = tree.getroot()
items = root.findall(".//item")
posts = [i for i in items if
    i.find(f"{{{WP_NS}}}post_type") is not None and i.find(f"{{{WP_NS}}}post_type").text == "post" and
    i.find(f"{{{WP_NS}}}status") is not None and i.find(f"{{{WP_NS}}}status").text == "publish"]
print(f"Found {len(posts)} published posts")

success = failed = skipped = 0

for i, item in enumerate(posts[:10]):  # Change posts[:10] to posts for full run
    wp_id = item.find(f"{{{WP_NS}}}post_id").text
    title = (item.find("title").text or "").strip()
    slug_raw = (item.find(f"{{{WP_NS}}}post_name").text or "").strip()
    slug = make_slug(slug_raw or title)
    date = (item.find(f"{{{WP_NS}}}post_date").text or "")[:10]
    content_el = item.find(f"{{{CONTENT_NS}}}encoded")
    html = content_el.text if content_el is not None else ""
    cats = list(set([c.text for c in item.findall("category") if c.text]))
    metas = item.findall(f"{{{WP_NS}}}postmeta")
    doc_id = f"wp-post-{wp_id}"

    if doc_id in log["done"]:
        print(f"[{i+1}] SKIP: {title}"); skipped += 1; continue

    is_quiz_post = any(
        meta.find(f"{{{WP_NS}}}meta_key") is not None and
        meta.find(f"{{{WP_NS}}}meta_key").text == "_abcm_quiz_json" and
        meta.find(f"{{{WP_NS}}}meta_value") is not None and
        meta.find(f"{{{WP_NS}}}meta_value").text and
        meta.find(f"{{{WP_NS}}}meta_value").text.strip()
        for meta in metas
    )
    if is_quiz_post:
        print(f"[{i+1}] QUIZ SKIP: {title}"); skipped += 1; continue

    yoast_desc = ""
    yoast_title = ""
    mcq_url = ""
    for meta in metas:
        mk = meta.find(f"{{{WP_NS}}}meta_key")
        mv = meta.find(f"{{{WP_NS}}}meta_value")
        if mk is None or mv is None: continue
        if mk.text == "_yoast_wpseo_metadesc" and mv.text and mv.text.strip():
            yoast_desc = mv.text.strip()
        if mk.text == "_yoast_wpseo_title" and mv.text and mv.text.strip():
            yoast_title = mv.text.strip()
        if mk.text == "_abcm_practice_url" and mv.text and mv.text.strip():
            mcq_url = mv.text.strip()

    blocks = html_to_blocks(html)
    doc = {
        "_id":doc_id,"_type":"article","title":title,
        "slug":{"_type":"slug","current":slug},
        "publishedAt":f"{date}T00:00:00Z" if date else None,
        "excerpt":yoast_desc if yoast_desc else None,
        "seoDescription":yoast_desc if yoast_desc else None,
        "seoTitle":yoast_title if yoast_title else None,
        "mcqUrl":mcq_url if mcq_url else None,
        "body":blocks,"canonicalOwner":"accountingbody",
        "showOnSites":["accountingbody"],
        "aiSearchable":False,"requiresQuarterlyReview":False,
        "tags":cats[:10],
    }
    doc = {k:v for k,v in doc.items() if v is not None}
    status, result = send_to_sanity(doc)
    if status == 200:
        log["done"].append(doc_id); save_log()
        print(f"[{i+1}] OK: {title}"); success += 1
    else:
        log["failed"].append({"id":doc_id,"title":title,"error":str(result)}); save_log()
        print(f"[{i+1}] FAIL: {title} -- {result}"); failed += 1
    time.sleep(0.3)

print(f"MIGRATION COMPLETE")
print(f"Success: {success} | Failed: {failed} | Skipped: {skipped}")