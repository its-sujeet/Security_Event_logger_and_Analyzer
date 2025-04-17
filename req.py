# from flask import Flask, request, jsonify
# from flask_cors import CORS
# import requests
# import json
# import logging
# import os

# app = Flask(__name__)
# CORS(app)

# # Configure logging
# logging.basicConfig(level=logging.DEBUG)
# logger = logging.getLogger(__name__)

# def gemini_request(input_text, prev_messages, params):
#     """
#     Send a request to the Gemini API to generate content based on input text and previous messages.
#     """
#     # Load API key from environment variable
#     api_key = os.environ.get('GEMINI_API_KEY')
#     if not api_key:
#         logger.error("Gemini API key is not set in environment variables")
#         return None

#     # Use the model from params or default to gemini-2.0-flash
#     default_model = "gemini-2.0-flash"
#     model = params.get("api_model", default_model)
#     url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

#     # Set headers
#     headers = {
#         "Content-Type": "application/json",
#     }

#     # Build messages list
#     messages = []
#     if prev_messages:
#         try:
#             # Parse prev_messages as a single message object
#             messages.append(json.loads(prev_messages))
#         except json.JSONDecodeError as e:
#             logger.error(f"Failed to parse prev_messages: {str(e)}")
#             return None
#     messages.append({"role": "user", "content": input_text})

#     # Transform into Gemini API's contents format
#     contents = [{"role": msg["role"], "parts": [{"text": msg["content"]}]} for msg in messages]
#     payload = {"contents": contents}

#     try:
#         logger.debug(f"Sending request to Gemini API: {json.dumps(payload)}")
#         response = requests.post(url, headers=headers, json=payload, timeout=10000)
#         response.raise_for_status()
#         return response.json()
#     except requests.RequestException as e:
#         logger.error(f"Failed to get response from Gemini API: {str(e)}")
#         return None

# def handle_gemini_response(response_json):
#     """
#     Extract the generated text from the Gemini API response.
#     """
#     try:
#         candidates = response_json.get("candidates", [])
#         if not candidates:
#             logger.error("No candidates in Gemini API response")
#             return None
#         first_candidate = candidates[0]
#         content = first_candidate.get("content", {})
#         parts = content.get("parts", [])
#         if not parts:
#             logger.error("No parts in candidate content")
#             return None
#         text = parts[0].get("text", "")
#         if not text:
#             logger.error("No text in part")
#             return None
#         return text
#     except Exception as e:
#         logger.error(f"Error handling Gemini response: {str(e)}")
#         return None

# @app.route("/api/chat", methods=["POST"])
# def chat_api():
#     """
#     Handle incoming POST requests to /api/chat, process input, and return Gemini API response.
#     """
#     try:
#         data = request.get_json()
#         if not data or "input_text" not in data:
#             logger.error("Invalid request: Missing input_text")
#             return jsonify({"error": "Missing input_text"}), 400

#         user_input = data["input_text"]
#         params = data.get("params", {})
#         prev_messages = data.get("prev_messages", "")

#         # Handle event details if provided
#         event_details = params.get("event_details", data.get("event_details", None))
#         if event_details:
#             event_details_str = json.dumps(event_details)
#             user_input = (
#                 f"{user_input}\n\n"
#                 f"Event Details: {event_details_str}\n\n"
#                 "If there are any potential vulnerabilities due to this event, please identify and explain them."
#             )

#         logger.debug(f"Processed request: input_text={user_input}, params={params}, prev_messages={prev_messages}")

#         # Get response from Gemini API
#         gemini_response = gemini_request(user_input, prev_messages, params)
#         if not gemini_response:
#             return jsonify({"error": "No response from Gemini API"}), 500

#         # Extract message from response
#         message = handle_gemini_response(gemini_response)
#         if message:
#             return jsonify({"response": message})
#         else:
#             return jsonify({"error": "No valid response message"}), 500

#     except Exception as e:
#         logger.error(f"Unexpected error in chat_api: {str(e)}")
#         return jsonify({"error": f"Server error: {str(e)}"}), 500

# if __name__ == "__main__":
#     app.run(host="0.0.0.0", port=5143, debug=True)


from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import logging
import os

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def gemini_request(input_text, params):
    """
    Send a request to the Gemini API to generate content based on input text.
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        logger.error("Gemini API key is not set in environment variables")
        return None

    default_model = "gemini-2.0-flash"
    model = params.get("api_model", default_model)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    headers = {
        "Content-Type": "application/json",
    }

    contents = [{
        "role": "user",
        "parts": [{"text": input_text}]
    }]
    payload = {"contents": contents}

    try:
        logger.debug(f"Sending request to Gemini API: {json.dumps(payload)}")
        response = requests.post(url, headers=headers, json=payload, timeout=10000)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Failed to get response from Gemini API: {str(e)}")
        return None

def handle_gemini_response(response_json):
    """
    Extract the generated text from the Gemini API response.
    """
    try:
        candidates = response_json.get("candidates", [])
        if not candidates:
            logger.error("No candidates in Gemini API response")
            return None
        first_candidate = candidates[0]
        content = first_candidate.get("content", {})
        parts = content.get("parts", [])
        if not parts:
            logger.error("No parts in candidate content")
            return None
        text = parts[0].get("text", "")
        if not text:
            logger.error("No text in part")
            return None
        return text
    except Exception as e:
        logger.error(f"Error handling Gemini response: {str(e)}")
        return None

@app.route("/api/chat", methods=["POST"])
def chat_api():
    """
    Handle incoming POST requests to /api/chat, process input, and return Gemini API response.
    """
    try:
        data = request.get_json()
        if not data or "input_text" not in data:
            logger.error("Invalid request: Missing input_text")
            return jsonify({"error": "Missing input_text"}), 400

        user_input = data["input_text"]
        params = data.get("params", {})

        event_details = params.get("event_details", data.get("event_details", None))
        if event_details:
            event_details_str = json.dumps(event_details)
            user_input = (
                f"{user_input}\n\n"
                f"Event Details: {event_details_str}\n\n"
                "If there are any potential vulnerabilities due to this event, please identify and explain them."
            )

        logger.debug(f"Processed request: input_text={user_input}, params={params}")

        gemini_response = gemini_request(user_input, params)
        if not gemini_response:
            return jsonify({"error": "No response from Gemini API"}), 500

        message = handle_gemini_response(gemini_response)
        if message:
            return jsonify({"response": message})
        else:
            return jsonify({"error": "No valid response message"}), 500

    except Exception as e:
        logger.error(f"Unexpected error in chat_api: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5143, debug=True)
