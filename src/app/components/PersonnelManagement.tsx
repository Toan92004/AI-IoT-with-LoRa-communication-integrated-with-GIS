import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  MoreVertical,
  Shield,
  Wrench,
  CircleUser,
  X,
  Edit,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Personnel {
  id: string;
  name: string;
  role: "admin" | "technician" | "analyst" | "user";
  email: string;
  phone: string;
  zone?: string;
  status: "online" | "offline" | "on_mission";
}

interface PersonnelManagementProps {
  currentUserEmail?: string;
}

export function PersonnelManagement({
  currentUserEmail = "admin@example.com",
}: PersonnelManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);

  // State cho dropdown menu (dấu 3 chấm)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // State quản lý Modal thêm mới
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPerson, setNewPerson] = useState({
    name: "",
    role: "technician",
    email: "",
    phone: "",
    zone: "KV1",
  });

  // State quản lý Modal chỉnh sửa
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Personnel | null>(null);

  // 1. KÉO DỮ LIỆU
  const fetchUsers = async () => {
    try {
      const response = await fetch("https://do-an-r2gd.onrender.com/api/users");
      const data = await response.json();
      const filteredData = data.filter(
        (user: Personnel) => user.email !== currentUserEmail,
      );
      setPersonnelList(filteredData);
    } catch (error) {
      console.error("Lỗi khi kéo danh sách nhân sự:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 10000);
    return () => clearInterval(interval);
  }, [currentUserEmail]);

  // 2. THÊM MỚI
  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        "https://do-an-r2gd.onrender.com/api/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newPerson),
        },
      );
      const data = await response.json();
      if (response.ok) {
        fetchUsers(); // Refresh lại danh sách
        setIsModalOpen(false);
        setNewPerson({
          name: "",
          role: "technician",
          email: "",
          phone: "",
          zone: "KV1",
        });
      } else {
        alert(`Lỗi: ${data.error}`);
      }
    } catch (error) {
      alert("Không thể kết nối đến máy chủ Server!");
    }
  };

  // 3. SỬA (CẬP NHẬT)
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;

    try {
      const response = await fetch(
        `https://do-an-r2gd.onrender.com/api/users/${editingPerson.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingPerson),
        },
      );

      if (response.ok) {
        fetchUsers(); // Refresh lại
        setIsEditModalOpen(false);
        setEditingPerson(null);
      } else {
        alert("Lỗi cập nhật!");
      }
    } catch (error) {
      alert("Không thể kết nối đến máy chủ Server!");
    }
  };

  // 4. XÓA
  const handleDelete = async (id: string, name: string) => {
    if (
      window.confirm(
        `Bạn có chắc chắn muốn xóa nhân sự "${name}" khỏi hệ thống không? Hành động này không thể hoàn tác.`,
      )
    ) {
      try {
        const response = await fetch(
          `https://do-an-r2gd.onrender.com/api/users/${id}`,
          {
            method: "DELETE",
          },
        );
        if (response.ok) {
          setPersonnelList((prev) => prev.filter((p) => p.id !== id));
          setOpenMenuId(null);
        }
      } catch (error) {
        alert("Không thể kết nối đến máy chủ Server!");
      }
    }
  };

  // Mở modal sửa
  const openEditModal = (person: Personnel) => {
    setEditingPerson(person);
    setIsEditModalOpen(true);
    setOpenMenuId(null); // Đóng menu
  };

  const filteredPersonnel = personnelList.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield size={16} className="text-purple-400" />;
      case "technician":
        return <Wrench size={16} className="text-cyan-400" />;
      case "analyst":
        return <CircleUser size={16} className="text-green-400" />;
      case "user":
        return <CircleUser size={16} className="text-gray-500" />;
      default:
        return <CircleUser size={16} />;
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case "admin":
        return "Quản trị viên";
      case "technician":
        return "Kỹ thuật viên";
      case "analyst":
        return "Chuyên gia AI";
      case "user":
        return "Chờ phân quyền";
      default:
        return role;
    }
  };

  return (
    <div
      className="h-full w-full bg-gray-950 p-6 overflow-y-auto"
      onClick={() => setOpenMenuId(null)}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Quản lý nhân sự
            </h1>
            <p className="text-gray-400">
              Danh sách nhân sự, kỹ thuật viên và phân quyền hệ thống.
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <Plus size={20} />
            <span>Thêm nhân sự</span>
          </button>
        </div>

        {/* Modal Thêm Nhân Sự */}
        <AnimatePresence>
          {isModalOpen && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                  <h3 className="text-white font-semibold">Thêm nhân sự mới</h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAddPersonnel} className="p-6 space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Họ và Tên
                    </label>
                    <input
                      required
                      placeholder="Nhập tên nhân sự..."
                      className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                      value={newPerson.name}
                      onChange={(e) =>
                        setNewPerson({ ...newPerson, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold">
                        Số điện thoại
                      </label>
                      <input
                        required
                        type="tel"
                        className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                        value={newPerson.phone}
                        onChange={(e) =>
                          setNewPerson({ ...newPerson, phone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold">
                        Vai trò
                      </label>
                      <select
                        className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                        value={newPerson.role}
                        onChange={(e) =>
                          setNewPerson({ ...newPerson, role: e.target.value })
                        }
                      >
                        <option value="technician">Kỹ thuật viên</option>
                        <option value="analyst">Chuyên gia AI</option>
                        <option value="admin">Quản trị viên</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Email (Dùng để đăng nhập)
                    </label>
                    <input
                      required
                      type="email"
                      placeholder="email@webgis.vn"
                      className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                      value={newPerson.email}
                      onChange={(e) =>
                        setNewPerson({ ...newPerson, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Khu vực phụ trách
                    </label>
                    <input
                      className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                      value={newPerson.zone}
                      onChange={(e) =>
                        setNewPerson({ ...newPerson, zone: e.target.value })
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-cyan-600 py-3 text-white font-bold rounded-lg hover:bg-cyan-500 transition-colors mt-4"
                  >
                    Tạo hồ sơ nhân viên
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Sửa Nhân Sự */}
        <AnimatePresence>
          {isEditModalOpen && editingPerson && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                  <h3 className="text-white font-semibold">Chỉnh sửa hồ sơ</h3>
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Họ và Tên
                    </label>
                    <input
                      required
                      className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                      value={editingPerson.name}
                      onChange={(e) =>
                        setEditingPerson({
                          ...editingPerson,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold">
                        Số điện thoại
                      </label>
                      <input
                        required
                        type="tel"
                        className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                        value={editingPerson.phone}
                        onChange={(e) =>
                          setEditingPerson({
                            ...editingPerson,
                            phone: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-bold">
                        Phân quyền
                      </label>
                      <select
                        className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                        value={editingPerson.role}
                        onChange={(e) =>
                          setEditingPerson({
                            ...editingPerson,
                            role: e.target.value as any,
                          })
                        }
                      >
                        <option value="user">Chờ phân quyền</option>
                        <option value="technician">Kỹ thuật viên</option>
                        <option value="analyst">Chuyên gia AI</option>
                        <option value="admin">Quản trị viên</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Email (Không thể sửa)
                    </label>
                    <input
                      disabled
                      type="email"
                      className="w-full bg-gray-950 border border-gray-700 text-gray-500 p-2.5 rounded-lg mt-1 cursor-not-allowed"
                      value={editingPerson.email}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-bold">
                      Khu vực phụ trách
                    </label>
                    <input
                      className="w-full bg-gray-950 border border-gray-700 text-white p-2.5 rounded-lg mt-1 focus:border-cyan-500 focus:outline-none"
                      value={editingPerson.zone || ""}
                      onChange={(e) =>
                        setEditingPerson({
                          ...editingPerson,
                          zone: e.target.value,
                        })
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-cyan-600 py-3 text-white font-bold rounded-lg hover:bg-cyan-500 transition-colors mt-4"
                  >
                    Lưu thay đổi
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Search & Stats */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="flex-1 bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                size={18}
              />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên hoặc email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-gray-900 border border-gray-800 px-6 py-4 rounded-xl flex flex-col justify-center">
              <div className="text-gray-400 text-sm mb-1">Chờ phân quyền</div>
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-gray-500 rounded-full"></span>
                {personnelList.filter((p) => p.role === "user").length}
              </div>
            </div>
            {/* Đã gỡ bỏ khối thống kê "Đang trực tuyến" ở đây */}
          </div>
        </div>

        {/* Personnel Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPersonnel.map((person, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={person.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors group relative overflow-hidden"
            >
              {/* Đã gỡ bỏ dải viền màu trạng thái ở đây */}

              <div className="flex justify-between items-start mb-4 mt-2">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-xl font-bold text-white border border-gray-700">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">
                      {person.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {getRoleIcon(person.role)}
                      <span className="text-sm text-gray-400">
                        {getRoleName(person.role)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3 Dots Menu Button */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(
                        openMenuId === person.id ? null : person.id,
                      );
                    }}
                    className="text-gray-500 hover:text-white p-1 rounded-md hover:bg-gray-800 transition-colors"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {openMenuId === person.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(person);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                        >
                          <Edit size={14} /> Chỉnh sửa
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(person.id, person.name);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                        >
                          <Trash2 size={14} /> Xóa nhân sự
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <Mail size={16} className="text-gray-500" />
                  <span className="truncate">{person.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <Phone size={16} className="text-gray-500" />
                  <span>{person.phone}</span>
                </div>
                {person.zone && (
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <MapPin size={16} className="text-gray-500" />
                    <span>
                      Phụ trách:{" "}
                      <span className="text-gray-300 font-medium">
                        {person.zone}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {filteredPersonnel.length === 0 && (
            <div className="col-span-full p-8 text-center text-gray-500">
              Chưa có nhân sự nào trong hệ thống.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
