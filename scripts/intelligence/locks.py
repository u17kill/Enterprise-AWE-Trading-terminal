"""OS leases release automatically on process exit, including cancelled refreshes."""
import contextlib
import os
import time

class BusyError(RuntimeError):
    pass

@contextlib.contextmanager
def lease(file, wait=False):
    file.parent.mkdir(parents=True,exist_ok=True)
    stream=open(file,'a+b')
    if os.path.getsize(file)==0:stream.write(b'0');stream.flush()
    acquired=False;deadline=time.monotonic()+300
    try:
        while not acquired:
            stream.seek(0)
            try:
                if os.name=='nt':
                    import msvcrt
                    msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
                else:
                    import fcntl
                    fcntl.flock(stream.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
                acquired=True
            except OSError:
                if not wait:raise BusyError('本页正在更新中')
                if time.monotonic()>deadline:raise BusyError('行情源正在处理其他请求，请稍后重试')
                time.sleep(.1)
        yield
    finally:
        if acquired:
            stream.seek(0)
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(stream.fileno(),msvcrt.LK_UNLCK,1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(),fcntl.LOCK_UN)
        stream.close()
