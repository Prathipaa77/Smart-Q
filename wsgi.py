from app import app

# Health check function
def health_check():
    try:
        # Test database connection if needed
        # Test other critical services
        return True
    except Exception as e:
        print(f"Health check failed: {str(e)}")
        return False

if __name__ == "__main__":
    app.run() 