import os
import time
import json
import subprocess
import logging
from pathlib import Path

import redis
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379')
PROJECTS_DIR = Path(os.getenv('PROJECTS_DIR', '/app/projects'))

redis_conn = redis.from_url(REDIS_URL, decode_responses=True)


def run_ffmpeg(cmd, cwd=None):
    logger.info("Running: %s", " ".join(cmd))
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error("FFmpeg stderr: %s", result.stderr)
        raise RuntimeError(f"FFmpeg failed: {result.stderr}")
    return result


def render_long_video(project_id, cover_path, audio_path, output_path):
    cover = PROJECTS_DIR / project_id / cover_path
    audio = PROJECTS_DIR / project_id / audio_path
    output = PROJECTS_DIR / project_id / output_path
    output.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg",
        "-y",
        "-loop", "1",
        "-i", str(cover),
        "-i", str(audio),
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(output)
    ]
    run_ffmpeg(cmd)
    return str(output)


def render_short(project_id, video_path, start, end, output_path):
    video = PROJECTS_DIR / project_id / video_path
    output = PROJECTS_DIR / project_id / output_path
    output.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(video),
        "-ss", start,
        "-to", end,
        "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-b:a", "192k",
        str(output)
    ]
    run_ffmpeg(cmd)
    return str(output)


def burn_subtitles(project_id, video_path, subtitle_path, output_path):
    video = PROJECTS_DIR / project_id / video_path
    subtitles = PROJECTS_DIR / project_id / subtitle_path
    output = PROJECTS_DIR / project_id / output_path

    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(video),
        "-vf", f"subtitles={subtitles}:force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2'",
        "-c:a", "copy",
        str(output)
    ]
    run_ffmpeg(cmd)
    return str(output)


def process_job(payload):
    task = payload.get('task')
    project_id = payload.get('project_id')

    if not task or not project_id:
        raise ValueError("Missing 'task' or 'project_id' in payload")

    if task == 'render_long':
        return render_long_video(
            project_id,
            payload['cover_path'],
            payload['audio_path'],
            payload['output_path']
        )
    elif task == 'render_short':
        return render_short(
            project_id,
            payload['video_path'],
            payload['start'],
            payload['end'],
            payload['output_path']
        )
    elif task == 'burn_subtitles':
        return burn_subtitles(
            project_id,
            payload['video_path'],
            payload['subtitle_path'],
            payload['output_path']
        )
    else:
        raise ValueError(f"Unknown task: {task}")


def main():
    logger.info("FFmpeg worker started. Waiting for jobs...")
    while True:
        try:
            item = redis_conn.brpop('bull:ffmpeg:wait', timeout=5)
            if not item:
                continue
            _, raw = item
            payload = json.loads(raw)
            logger.info("Processing job: %s", payload)
            result = process_job(payload)
            redis_conn.lpush('bull:ffmpeg:completed', json.dumps({
                'jobId': payload.get('id'),
                'result': result
            }))
            logger.info("Job completed: %s", result)
        except Exception as e:
            logger.error("Job failed: %s", e)
            time.sleep(1)


if __name__ == '__main__':
    main()
