from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

status_req_made = False
vqd = ""

def fetch_vqd():
    global status_req_made, vqd
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
        "Accept": "text/event-stream",
        "Accept-Language": "en-US;q=0.7,en;q=0.3",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://duckduckgo.com/",
        "Content-Type": "application/json",
        "Origin": "https://duckduckgo.com",
        "Connection": "keep-alive",
        "Cookie": "dcm=1",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Pragma": "no-cache",
        "TE": "trailers",
        "x-vqd-accept": "1",
        "Cache-Control": "no-store"
    }
    
    if not status_req_made:
        try:
            logger.debug("Fetching VQD token...")
            response = requests.get("https://duckduckgo.com/duckchat/v1/status", headers=headers, timeout=10)
            response.raise_for_status()
            vqd = response.headers.get("x-vqd-4")
            if not vqd:
                logger.error("No x-vqd-4 header in response")
                return None
            logger.debug(f"VQD token fetched: {vqd}")
            status_req_made = True
        except requests.RequestException as e:
            logger.error(f"Failed to fetch VQD: {str(e)}")
            return None
    return vqd

def new_request(input_text, event_details, model="gpt-4o-mini"):
    global vqd
    
    if not vqd:
        logger.error("VQD token not available")
        return None
    
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
        "Accept": "text/event-stream",
        "Accept-Language": "en-US;q=0.7,en;q=0.3",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://duckduckgo.com/",
        "Content-Type": "application/json",
        "Origin": "https://duckduckgo.com",
        "Connection": "keep-alive",
        "Cookie": "dcm=1",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Pragma": "no-cache",
        "TE": "trailers",
        "x-vqd-4": vqd,
        "Cache-Control": "no-store"
    }
    
    # Combine input text with event details for context
    event_context = f"Event Details: ID={event_details['event_id']}, Category={event_details['category']}, Source={event_details['source']}, Time={event_details['time_generated']}, Severity={event_details['severity']}, Message={event_details['message']}"
    full_input = f"{event_context}\nUser Query: {input_text}"
    
    message_data = {
        "messages": [{"role": "user", "content": full_input}],
        "model": model
    }
    
    try:
        logger.debug(f"Sending request to DuckDuckGo API: {json.dumps(message_data)}")
        response = requests.post("https://duckduckgo.com/duckchat/v1/chat", headers=headers, data=json.dumps(message_data), timeout=10)
        response.raise_for_status()
        logger.debug(f"Response received: {response.text[:100]}...")
        return response.text
    except requests.RequestException as e:
        logger.error(f"Failed to get response from DuckDuckGo API: {str(e)}")
        return None

def handle_response(response_text):
    try:
        lines = response_text.splitlines()
        full_message = ""
        for index, line in enumerate(lines):
            if index == 0:
                continue
            if line.startswith("data: "):
                json_data = line[6:]
                try:
                    data = json.loads(json_data)
                    if "message" in data:
                        full_message += data["message"]
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse JSON: {json_data} - {str(e)}")
                    continue
        result = full_message.strip() if full_message else None
        logger.debug(f"Parsed message: {result}")
        return result
    except Exception as e:
        logger.error(f"Error handling response: {str(e)}")
        return None

@app.route("/api/chat", methods=["POST"])
def chat_api():
    try:
        data = request.get_json()
        if not data or "input_text" not in data or "event_details" not in data:
            logger.error("Invalid request: Missing input_text or event_details")
            return jsonify({"error": "Missing input_text or event_details"}), 400
        
        user_input = data["input_text"]
        event_details = data["event_details"]
        logger.debug(f"Received request: input_text={user_input}, event_details={event_details}")

        vqd_token = fetch_vqd()
        if not vqd_token:
            return jsonify({"error": "Failed to fetch VQD token"}), 500

        response_text = new_request(user_input, event_details)
        if not response_text:
            return jsonify({"error": "No response from DuckDuckGo API"}), 500

        message = handle_response(response_text)
        if message:
            return jsonify({"response": message})
        else:
            return jsonify({"error": "No valid response message"}), 500
    except Exception as e:
        logger.error(f"Unexpected error in chat_api: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5143, debug=True)