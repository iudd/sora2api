FROM python:3.11-slim

WORKDIR /app

# Create a non-root user with ID 1000
RUN useradd -m -u 1000 user

# Create necessary directories and set permissions
# We need to ensure /app/data and /app/tmp exist and are writable by the user
RUN mkdir -p /app/data /app/tmp && \
    chown -R user:user /app

# Switch to the non-root user
USER user

# Set environment variables
ENV PATH="/home/user/.local/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Copy requirements first to leverage cache
COPY --chown=user:user requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY --chown=user:user . .

# Expose the port
EXPOSE 7860

# Run the application
CMD ["python", "main.py"]
