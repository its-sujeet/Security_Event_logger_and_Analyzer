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

def new_request(input_text, prev_messages, params):
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
        "x-vqd-hash-1": "abcdefg",
        "Cache-Control": "no-store"
    }
    
    model = "o3-mini"
    if params.get("api_model"):
        model = params["api_model"]
    
    messages = []
    if prev_messages:
        messages.append(prev_messages)
    messages.append(json.dumps({
        "role": "user",
        "content": input_text
    }))
    
    message_data = {
        "messages": [json.loads(m) for m in messages],
        "model": model
    }
    
    try:
        logger.debug(f"Sending request to DuckDuckGo API: {json.dumps(message_data)}")
        response = requests.post("https://duckduckgo.com/duckchat/v1/chat", headers=headers, json=message_data, timeout=10)
        response.raise_for_status()
        logger.debug(f"Response received: {response.text[:100]}...")
        return response.text
    except requests.RequestException as e:
        logger.error(f"Failed to get response from DuckDuckGo API: {str(e)}")
        return None

# def handle_response(response_text):
#     try:
#         lines = response_text.splitlines()
#         full_message = ""
#         for line in lines:
#             if line.startswith("data: "):
#                 json_data = line[6:]
#                 try:
#                     data = json.loads(json_data)
#                     if "message" in data:
#                         full_message += data["message"]
#                 except json.JSONDecodeError as e:
#                     logger.warning(f"Failed to parse JSON: {json_data} - {str(e)}")
#                     continue
#         result = full_message.strip() if full_message else None
#         logger.debug(f"Parsed message: {result}")
#         return result
#     except Exception as e:
#         logger.error(f"Error handling response: {str(e)}")
#         return None



def handle_response(response_text):
    try:
        lines = response_text.splitlines()
        full_message = ""
        for line in lines:
            if line.startswith("data: "):
                json_data = line[6:]
                try:
                    data = json.loads(json_data)
                    if "message" in data:
                        full_message += data["message"]
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse JSON: {json_data} - {str(e)}")
                    continue
        
        if not full_message:
            return None

        # Format the response with bold headings and proper spacing
        formatted_message = ""
        sections = full_message.split("\n\n")  # Split by double newlines for paragraphs
        for section in sections:
            section = section.strip()
            if section:
                if section.startswith("### ") or section.startswith("--- "):
                    # Bold and format main headings
                    formatted_message += f"**{section.replace('### ', '').replace('--- ', '')}**\n\n"
                elif section.startswith("- **") or section.startswith("**"):
                    # Preserve subheadings or already bolded items
                    formatted_message += f"{section}\n\n"
                elif section.startswith("- "):
                    # Format bullet points
                    formatted_message += f"{section}\n"
                else:
                    # Normal text
                    formatted_message += f"{section}\n\n"
        
        result = formatted_message.strip()
        logger.debug(f"Parsed and formatted message: {result}")
        return result
    except Exception as e:
        logger.error(f"Error handling response: {str(e)}")
        return None



@app.route("/api/chat", methods=["POST"])
def chat_api():
    try:
        data = request.get_json()
        if not data or "input_text" not in data:
            logger.error("Invalid request: Missing input_text")
            return jsonify({"error": "Missing input_text"}), 400
        
        user_input = data["input_text"]
        params = data.get("params", {})  # Optional, default to empty dict
        prev_messages = data.get("prev_messages", "")  # Optional, match frontend
        
        # Extract event_details from params if it exists, otherwise from top-level
        event_details = params.get("event_details", data.get("event_details", None))
        
        # Combine event_details with input_text and add vulnerability prompt
        if event_details:
            event_details_str = json.dumps(event_details)
            user_input = (
                f"{user_input}\n\n"
                f"Event Details: {event_details_str}\n\n"
                f"If there are any potential vulnerabilities due to this event, please identify and explain them."
            )
        
        logger.debug(f"Processed request: input_text={user_input}, params={params}, prev_messages={prev_messages}, event_details={event_details}")

        vqd_token = fetch_vqd()
        if not vqd_token:
            return jsonify({"error": "Failed to fetch VQD token"}), 500

        response_text = new_request(user_input, prev_messages, params)
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